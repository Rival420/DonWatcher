// DonWatcher Beacon Agent v2.0 (Go Edition)
//
// A lightweight C2-style agent for blue team security operations.
// Compiles to a single Windows executable with optional service installation.
//
// Features:
// - Beacon protocol with configurable sleep + jitter
// - Job queue execution (PowerShell, shell, domain scans)
// - Windows service installation via kardianos/service
// - Cross-compiled from Linux server - no Python needed!
//
// Build:
//   GOOS=windows GOARCH=amd64 go build -ldflags "-X main.ServerURL=http://server:8080" -o beacon.exe
//
// Usage:
//   beacon.exe                    # Run interactively
//   beacon.exe install            # Install as Windows service
//   beacon.exe uninstall          # Remove Windows service
//   beacon.exe start              # Start the service
//   beacon.exe stop               # Stop the service

package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/kardianos/service"
)

// =============================================================================
// Build-time Configuration (embedded via ldflags)
// =============================================================================

// These variables are set at build time using:
//   go build -ldflags "-X main.ServerURL=http://... -X main.SleepInterval=60"
var (
	ServerURL     = "http://localhost:8080" // -X main.ServerURL=...
	SleepInterval = "60"                    // -X main.SleepInterval=...
	JitterPercent = "10"                    // -X main.JitterPercent=...
	VerifySSL     = "true"                  // -X main.VerifySSL=...
	DebugMode     = "false"                 // -X main.DebugMode=...
	Version       = "2.0.0"                 // -X main.Version=...
)

// =============================================================================
// Data Models
// =============================================================================

type CheckinRequest struct {
	BeaconID      string `json:"beacon_id"`
	Hostname      string `json:"hostname"`
	InternalIP    string `json:"internal_ip"`
	OSInfo        string `json:"os_info"`
	Username      string `json:"username"`
	Domain        string `json:"domain"`
	ProcessName   string `json:"process_name"`
	ProcessID     int    `json:"process_id"`
	Architecture  string `json:"architecture"`
	BeaconVersion string `json:"beacon_version"`
}

type CheckinResponse struct {
	Status        string `json:"status"`
	BeaconUUID    string `json:"beacon_uuid"`
	SleepInterval int    `json:"sleep_interval"`
	JitterPercent int    `json:"jitter_percent"`
	Jobs          []Job  `json:"jobs"`
}

type Job struct {
	ID         string                 `json:"id"`
	JobType    string                 `json:"job_type"`
	Command    string                 `json:"command"`
	Parameters map[string]interface{} `json:"parameters"`
	Priority   int                    `json:"priority"`
	Notes      string                 `json:"notes"`
}

type JobResult struct {
	JobID       string  `json:"job_id"`
	BeaconID    string  `json:"beacon_id"`
	Status      string  `json:"status"`
	Output      *string `json:"output"`
	Error       *string `json:"error"`
	ExitCode    *int    `json:"exit_code"`
	CompletedAt string  `json:"completed_at"`
}

// =============================================================================
// Beacon Agent
// =============================================================================

type Beacon struct {
	config        Config
	beaconID      string
	systemInfo    CheckinRequest
	running       bool
	httpClient    *http.Client
	sleepInterval int
	jitterPercent int
	logger        *log.Logger
}

type Config struct {
	ServerURL     string
	SleepInterval int
	JitterPercent int
	VerifySSL     bool
	Debug         bool
}

func NewBeacon(cfg Config) *Beacon {
	b := &Beacon{
		config:        cfg,
		sleepInterval: cfg.SleepInterval,
		jitterPercent: cfg.JitterPercent,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		logger: log.New(os.Stdout, "[BEACON] ", log.LstdFlags),
	}
	b.beaconID = b.generateBeaconID()
	b.systemInfo = b.collectSystemInfo()
	return b
}

func (b *Beacon) generateBeaconID() string {
	hostname, _ := os.Hostname()
	
	// Get MAC address for uniqueness
	macAddr := "unknown"
	interfaces, err := net.Interfaces()
	if err == nil {
		for _, iface := range interfaces {
			if len(iface.HardwareAddr) > 0 {
				macAddr = iface.HardwareAddr.String()
				break
			}
		}
	}
	
	// Create hash-based ID
	uniqueString := fmt.Sprintf("%s-%s-%s", hostname, macAddr, runtime.GOOS)
	hash := sha256.Sum256([]byte(uniqueString))
	shortHash := hex.EncodeToString(hash[:])[:16]
	
	return fmt.Sprintf("BEACON-%s", strings.ToUpper(shortHash))
}

func (b *Beacon) collectSystemInfo() CheckinRequest {
	hostname, _ := os.Hostname()
	username := os.Getenv("USERNAME")
	if username == "" {
		username = os.Getenv("USER")
	}
	domain := os.Getenv("USERDOMAIN")
	if domain == "" {
		domain = "WORKGROUP"
	}
	
	// Get internal IP
	internalIP := "127.0.0.1"
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err == nil {
		localAddr := conn.LocalAddr().(*net.UDPAddr)
		internalIP = localAddr.IP.String()
		conn.Close()
	}
	
	osInfo := fmt.Sprintf("%s %s", runtime.GOOS, runtime.GOARCH)
	
	return CheckinRequest{
		BeaconID:      b.beaconID,
		Hostname:      hostname,
		InternalIP:    internalIP,
		OSInfo:        osInfo,
		Username:      username,
		Domain:        domain,
		ProcessName:   os.Args[0],
		ProcessID:     os.Getpid(),
		Architecture:  runtime.GOARCH,
		BeaconVersion: Version,
	}
}

func (b *Beacon) log(format string, args ...interface{}) {
	b.logger.Printf(format, args...)
}

func (b *Beacon) debug(format string, args ...interface{}) {
	if b.config.Debug {
		b.logger.Printf("[DEBUG] "+format, args...)
	}
}

func (b *Beacon) httpRequest(endpoint, method string, body interface{}) ([]byte, error) {
	url := strings.TrimRight(b.config.ServerURL, "/") + endpoint
	
	var reqBody io.Reader
	if body != nil {
		jsonData, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request: %w", err)
		}
		reqBody = bytes.NewBuffer(jsonData)
	}
	
	req, err := http.NewRequest(method, url, reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", fmt.Sprintf("DonWatcher-Beacon/%s", Version))
	
	resp, err := b.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()
	
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}
	
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("server returned %d: %s", resp.StatusCode, string(respBody))
	}
	
	return respBody, nil
}

func (b *Beacon) Checkin() (*CheckinResponse, error) {
	b.debug("Checking in to %s", b.config.ServerURL)
	
	respBody, err := b.httpRequest("/api/beacons/checkin", "POST", b.systemInfo)
	if err != nil {
		return nil, err
	}
	
	var response CheckinResponse
	if err := json.Unmarshal(respBody, &response); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}
	
	// Update sleep settings from server
	if response.SleepInterval > 0 {
		b.sleepInterval = response.SleepInterval
	}
	if response.JitterPercent >= 0 {
		b.jitterPercent = response.JitterPercent
	}
	
	b.debug("Check-in successful. Jobs: %d", len(response.Jobs))
	return &response, nil
}

func (b *Beacon) SubmitResult(result JobResult) error {
	_, err := b.httpRequest("/api/beacons/result", "POST", result)
	return err
}

func (b *Beacon) ExecuteJob(job Job) JobResult {
	b.log("Executing job %s: %s", job.ID, job.JobType)
	
	result := JobResult{
		JobID:       job.ID,
		BeaconID:    b.beaconID,
		Status:      "completed",
		CompletedAt: time.Now().UTC().Format(time.RFC3339),
	}
	
	var output, errMsg string
	var exitCode int
	
	switch job.JobType {
	case "domain_scan":
		output, errMsg, exitCode = b.executeDomainScan(job.Parameters)
	case "powershell":
		output, errMsg, exitCode = b.executePowerShell(job.Command)
	case "shell":
		output, errMsg, exitCode = b.executeShell(job.Command)
	case "system_info":
		output, errMsg, exitCode = b.executeSystemInfo()
	default:
		errMsg = fmt.Sprintf("Unknown job type: %s", job.JobType)
		exitCode = 1
	}
	
	if exitCode != 0 {
		result.Status = "failed"
	}
	
	if output != "" {
		result.Output = &output
	}
	if errMsg != "" {
		result.Error = &errMsg
	}
	result.ExitCode = &exitCode
	
	return result
}

func (b *Beacon) executePowerShell(script string) (string, string, int) {
	if runtime.GOOS != "windows" {
		return "", "PowerShell is only available on Windows", 1
	}
	
	cmd := exec.Command("powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	
	err := cmd.Run()
	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			return "", err.Error(), 1
		}
	}
	
	return stdout.String(), stderr.String(), exitCode
}

func (b *Beacon) executeShell(command string) (string, string, int) {
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.Command("cmd.exe", "/c", command)
	} else {
		cmd = exec.Command("/bin/sh", "-c", command)
	}
	
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	
	err := cmd.Run()
	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			return "", err.Error(), 1
		}
	}
	
	return stdout.String(), stderr.String(), exitCode
}

func (b *Beacon) executeDomainScan(params map[string]interface{}) (string, string, int) {
	// PowerShell script for domain group scanning
	script := `
#Requires -Modules ActiveDirectory
$ErrorActionPreference = "Stop"

function Get-DomainInfo {
    $domain = Get-ADDomain -ErrorAction Stop
    return @{
        DomainName = $domain.DNSRoot
        DomainSID  = $domain.DomainSID.Value
    }
}

function Get-GroupMemberships {
    param([string[]]$Groups)
    
    $result = @()
    foreach ($groupName in $Groups) {
        try {
            $adGroup = Get-ADGroup -Identity $groupName -ErrorAction SilentlyContinue
            if (-not $adGroup) { continue }
            
            $members = @()
            $groupMembers = Get-ADGroupMember -Identity $groupName -Recursive -ErrorAction SilentlyContinue
            
            foreach ($m in $groupMembers) {
                try {
                    $obj = Get-ADObject -Identity $m.DistinguishedName -Properties Name, sAMAccountName, objectSID, objectClass -ErrorAction SilentlyContinue
                    if ($obj) {
                        $members += @{
                            name = [string]$obj.Name
                            samaccountname = [string]$obj.sAMAccountName
                            sid = if ($obj.objectSID) { [string]$obj.objectSID.Value } else { "" }
                            type = [string]$obj.objectClass
                        }
                    }
                } catch { }
            }
            
            $result += @{
                group_name = $groupName
                members = $members
            }
        } catch { }
    }
    return $result
}

$privilegedGroups = @(
    "Domain Admins", "Enterprise Admins", "Schema Admins", "Administrators",
    "Account Operators", "Backup Operators", "Server Operators", "Print Operators"
)

$domainInfo = Get-DomainInfo
$groups = Get-GroupMemberships -Groups $privilegedGroups

@{
    domain = $domainInfo.DomainName
    domain_sid = $domainInfo.DomainSID
    groups = $groups
    timestamp = (Get-Date).ToString("o")
} | ConvertTo-Json -Depth 10
`
	return b.executePowerShell(script)
}

func (b *Beacon) executeSystemInfo() (string, string, int) {
	info := map[string]interface{}{
		"hostname":     b.systemInfo.Hostname,
		"domain":       b.systemInfo.Domain,
		"username":     b.systemInfo.Username,
		"os":           runtime.GOOS,
		"architecture": runtime.GOARCH,
		"internal_ip":  b.systemInfo.InternalIP,
		"beacon_id":    b.beaconID,
		"version":      Version,
		"timestamp":    time.Now().UTC().Format(time.RFC3339),
	}
	
	jsonData, err := json.MarshalIndent(info, "", "  ")
	if err != nil {
		return "", err.Error(), 1
	}
	return string(jsonData), "", 0
}

func (b *Beacon) calculateSleepWithJitter() time.Duration {
	jitterRange := float64(b.sleepInterval) * (float64(b.jitterPercent) / 100.0)
	jitter := (rand.Float64() * 2 * jitterRange) - jitterRange
	sleepSeconds := float64(b.sleepInterval) + jitter
	if sleepSeconds < 5 {
		sleepSeconds = 5
	}
	return time.Duration(sleepSeconds) * time.Second
}

func (b *Beacon) Run() {
	b.running = true
	
	b.log("DonWatcher Beacon v%s (Go) starting", Version)
	b.log("Beacon ID: %s", b.beaconID)
	b.log("Server: %s", b.config.ServerURL)
	b.log("Sleep: %ds (+/- %d%% jitter)", b.sleepInterval, b.jitterPercent)
	b.log("System: %s/%s", runtime.GOOS, runtime.GOARCH)
	b.log("User: %s@%s", b.systemInfo.Username, b.systemInfo.Domain)
	
	for b.running {
		// Check in and get jobs
		response, err := b.Checkin()
		if err != nil {
			b.log("Check-in failed: %v", err)
		} else if len(response.Jobs) > 0 {
			for _, job := range response.Jobs {
				b.log("Processing job: %s", job.ID)
				
				result := b.ExecuteJob(job)
				
				if err := b.SubmitResult(result); err != nil {
					b.log("Failed to submit result for job %s: %v", job.ID, err)
				} else {
					b.log("Job %s completed: %s", job.ID, result.Status)
				}
			}
		}
		
		// Sleep with jitter
		if b.running {
			sleepDuration := b.calculateSleepWithJitter()
			b.debug("Sleeping for %v", sleepDuration)
			time.Sleep(sleepDuration)
		}
	}
	
	b.log("Beacon stopped")
}

func (b *Beacon) Stop() {
	b.running = false
}

// =============================================================================
// Windows Service Support (kardianos/service)
// =============================================================================

type beaconService struct {
	beacon *Beacon
}

func (s *beaconService) Start(svc service.Service) error {
	go s.beacon.Run()
	return nil
}

func (s *beaconService) Stop(svc service.Service) error {
	s.beacon.Stop()
	return nil
}

// =============================================================================
// Main Entry Point
// =============================================================================

func parseConfig() Config {
	// Parse build-time embedded values
	sleepInt := 60
	fmt.Sscanf(SleepInterval, "%d", &sleepInt)
	
	jitterInt := 10
	fmt.Sscanf(JitterPercent, "%d", &jitterInt)
	
	verifySSL := VerifySSL == "true"
	debugMode := DebugMode == "true"
	
	// Command line flags override embedded config
	serverFlag := flag.String("server", "", "DonWatcher server URL")
	sleepFlag := flag.Int("sleep", 0, "Sleep interval in seconds")
	jitterFlag := flag.Int("jitter", 0, "Jitter percentage")
	debugFlag := flag.Bool("debug", false, "Enable debug logging")
	flag.Parse()
	
	cfg := Config{
		ServerURL:     ServerURL,
		SleepInterval: sleepInt,
		JitterPercent: jitterInt,
		VerifySSL:     verifySSL,
		Debug:         debugMode,
	}
	
	// Apply flag overrides
	if *serverFlag != "" {
		cfg.ServerURL = *serverFlag
	}
	if *sleepFlag > 0 {
		cfg.SleepInterval = *sleepFlag
	}
	if *jitterFlag > 0 {
		cfg.JitterPercent = *jitterFlag
	}
	if *debugFlag {
		cfg.Debug = true
	}
	
	return cfg
}

func main() {
	cfg := parseConfig()
	
	// Get executable name for service
	exePath, _ := os.Executable()
	exeName := filepath.Base(exePath)
	serviceName := strings.TrimSuffix(exeName, filepath.Ext(exeName))
	if serviceName == "" {
		serviceName = "DonWatcherBeacon"
	}
	
	// Service configuration
	svcConfig := &service.Config{
		Name:        serviceName,
		DisplayName: "DonWatcher Beacon Agent",
		Description: "DonWatcher security monitoring beacon agent for blue team operations",
	}
	
	beacon := NewBeacon(cfg)
	svc := &beaconService{beacon: beacon}
	
	s, err := service.New(svc, svcConfig)
	if err != nil {
		log.Fatalf("Failed to create service: %v", err)
	}
	
	// Handle service control commands
	if len(os.Args) > 1 {
		cmd := os.Args[1]
		switch cmd {
		case "install":
			err = s.Install()
			if err != nil {
				log.Fatalf("Failed to install service: %v", err)
			}
			fmt.Println("Service installed successfully!")
			fmt.Printf("  Name: %s\n", svcConfig.Name)
			fmt.Printf("  Server: %s\n", cfg.ServerURL)
			fmt.Println("\nTo start the service:")
			fmt.Println("  sc start", svcConfig.Name)
			fmt.Println("  -or-")
			fmt.Printf("  %s start\n", exeName)
			return
			
		case "uninstall", "remove":
			err = s.Uninstall()
			if err != nil {
				log.Fatalf("Failed to uninstall service: %v", err)
			}
			fmt.Println("Service uninstalled successfully!")
			return
			
		case "start":
			err = s.Start()
			if err != nil {
				log.Fatalf("Failed to start service: %v", err)
			}
			fmt.Println("Service started!")
			return
			
		case "stop":
			err = s.Stop()
			if err != nil {
				log.Fatalf("Failed to stop service: %v", err)
			}
			fmt.Println("Service stopped!")
			return
			
		case "restart":
			err = s.Restart()
			if err != nil {
				log.Fatalf("Failed to restart service: %v", err)
			}
			fmt.Println("Service restarted!")
			return
			
		case "status":
			status, err := s.Status()
			if err != nil {
				log.Fatalf("Failed to get status: %v", err)
			}
			statusText := map[service.Status]string{
				service.StatusRunning: "Running",
				service.StatusStopped: "Stopped",
				service.StatusUnknown: "Unknown",
			}
			fmt.Printf("Service status: %s\n", statusText[status])
			return
			
		case "run":
			// Run interactively (foreground)
			beacon.Run()
			return
			
		case "version":
			fmt.Printf("DonWatcher Beacon v%s (Go)\n", Version)
			fmt.Printf("Server: %s\n", cfg.ServerURL)
			fmt.Printf("Sleep: %ds, Jitter: %d%%\n", cfg.SleepInterval, cfg.JitterPercent)
			return
			
		case "help", "-h", "--help":
			fmt.Printf("DonWatcher Beacon v%s (Go)\n\n", Version)
			fmt.Println("Usage:")
			fmt.Printf("  %s [command] [flags]\n\n", exeName)
			fmt.Println("Commands:")
			fmt.Println("  install    Install as Windows service")
			fmt.Println("  uninstall  Remove Windows service")
			fmt.Println("  start      Start the service")
			fmt.Println("  stop       Stop the service")
			fmt.Println("  restart    Restart the service")
			fmt.Println("  status     Get service status")
			fmt.Println("  run        Run interactively (foreground)")
			fmt.Println("  version    Show version info")
			fmt.Println("  help       Show this help")
			fmt.Println("\nFlags:")
			fmt.Println("  -server    Override server URL")
			fmt.Println("  -sleep     Override sleep interval")
			fmt.Println("  -jitter    Override jitter percentage")
			fmt.Println("  -debug     Enable debug logging")
			fmt.Println("\nExamples:")
			fmt.Printf("  %s install              # Install as service\n", exeName)
			fmt.Printf("  %s run -debug           # Run interactively with debug\n", exeName)
			fmt.Printf("  %s run -server http://x # Override server URL\n", exeName)
			return
		}
	}
	
	// Default: run as service or interactively
	err = s.Run()
	if err != nil {
		// If service run fails, we might be running interactively
		beacon.Run()
	}
}

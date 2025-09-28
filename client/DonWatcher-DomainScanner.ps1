#Requires -Modules ActiveDirectory
<#
.SYNOPSIS
    DonWatcher Domain Scanner Agent - PowerShell Script
    
.DESCRIPTION
    A configurable PowerShell script that scans Active Directory domain information
    and sends the results back to a DonWatcher instance via REST API.
    
    This script collects:
    - Domain and forest information
    - Privileged group memberships
    - User and computer counts
    - Domain controller information
    
.PARAMETER DonWatcherUrl
    The base URL of the DonWatcher instance (e.g., "http://donwatcher.company.com:8080")
    
.PARAMETER ConfigFile
    Path to a JSON configuration file (optional)
    
.PARAMETER Groups
    Comma-separated list of privileged groups to monitor (optional)
    
.PARAMETER TestConnection
    Test connection to DonWatcher without sending data
    
.PARAMETER Verbose
    Enable verbose output
    
.EXAMPLE
    .\DonWatcher-DomainScanner.ps1 -DonWatcherUrl "http://192.168.1.100:8080"
    
.EXAMPLE
    .\DonWatcher-DomainScanner.ps1 -ConfigFile "config.json" -Verbose
    
.EXAMPLE
    .\DonWatcher-DomainScanner.ps1 -DonWatcherUrl "http://donwatcher:8080" -TestConnection
    
.NOTES
    Author: DonWatcher Team
    Version: 1.0
    Requires: PowerShell 5.1+, ActiveDirectory Module, Domain-joined machine
    
.LINK
    https://github.com/rival420/DonWatcher
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [string]$DonWatcherUrl,
    
    [Parameter(Mandatory=$false)]
    [string]$ConfigFile = "DonWatcher-Config.json",
    
    [Parameter(Mandatory=$false)]
    [string[]]$Groups,
    
    [Parameter(Mandatory=$false)]
    [switch]$TestConnection,
    
    [Parameter(Mandatory=$false)]
    [switch]$Verbose
)

# Set error handling
$ErrorActionPreference = "Stop"
if ($Verbose) { $VerbosePreference = "Continue" }

#region Configuration
# Default configuration
$DefaultConfig = @{
    DonWatcherUrl = "http://localhost:8080"
    PrivilegedGroups = @(
        "Domain Admins",
        "Enterprise Admins", 
        "Schema Admins",
        "Administrators",
        "Account Operators",
        "Backup Operators",
        "Server Operators",
        "Print Operators"
    )
    MaxUsers = 5000
    MaxComputers = 5000
    TimeoutSeconds = 300
    UserAgent = "DonWatcher-DomainScanner/1.0"
    LogLevel = "Info"
}

# Load configuration from file if it exists
$Config = $DefaultConfig.Clone()
if (Test-Path $ConfigFile) {
    try {
        Write-Verbose "Loading configuration from: $ConfigFile"
        $FileConfig = Get-Content $ConfigFile | ConvertFrom-Json
        
        # Merge configurations
        foreach ($key in $FileConfig.PSObject.Properties.Name) {
            $Config[$key] = $FileConfig.$key
        }
        Write-Verbose "Configuration loaded successfully"
    }
    catch {
        Write-Warning "Failed to load config file '$ConfigFile': $($_.Exception.Message)"
        Write-Warning "Using default configuration"
    }
}

# Override with command line parameters
if ($DonWatcherUrl) { $Config.DonWatcherUrl = $DonWatcherUrl }
if ($Groups) { $Config.PrivilegedGroups = $Groups }

Write-Verbose "Using DonWatcher URL: $($Config.DonWatcherUrl)"
#endregion

#region Logging
function Write-Log {
    param(
        [string]$Message,
        [ValidateSet("Info", "Warning", "Error", "Debug")]
        [string]$Level = "Info"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    
    switch ($Level) {
        "Info" { Write-Host $logMessage -ForegroundColor Green }
        "Warning" { Write-Warning $logMessage }
        "Error" { Write-Error $logMessage }
        "Debug" { if ($Verbose) { Write-Host $logMessage -ForegroundColor Cyan } }
    }
}
#endregion

#region Helper Functions
function Test-Prerequisites {
    Write-Log "Checking prerequisites..." -Level Debug
    
    # Check if running on domain-joined machine
    try {
        $domain = (Get-WmiObject Win32_ComputerSystem).Domain
        if (-not $domain -or $domain -eq "WORKGROUP") {
            throw "This machine is not domain-joined"
        }
        Write-Log "Domain detected: $domain" -Level Debug
    }
    catch {
        Write-Log "Failed to detect domain: $($_.Exception.Message)" -Level Error
        return $false
    }
    
    # Check Active Directory module
    try {
        Import-Module ActiveDirectory -ErrorAction Stop
        Write-Log "Active Directory module loaded successfully" -Level Debug
    }
    catch {
        Write-Log "Active Directory module not available: $($_.Exception.Message)" -Level Error
        Write-Log "Please install RSAT-AD-PowerShell feature" -Level Error
        return $false
    }
    
    return $true
}

function Test-DonWatcherConnection {
    param([string]$BaseUrl)
    
    Write-Log "Testing connection to DonWatcher at: $BaseUrl" -Level Debug
    
    try {
        $statusUrl = "$BaseUrl/api/debug/status"
        $response = Invoke-RestMethod -Uri $statusUrl -Method Get -TimeoutSec 30 -UseBasicParsing
        
        if ($response.status -eq "ok") {
            Write-Log "✅ DonWatcher connection successful" -Level Info
            Write-Log "Database connected: $($response.database_connected)" -Level Debug
            Write-Log "Reports count: $($response.reports_count)" -Level Debug
            return $true
        }
        else {
            Write-Log "❌ DonWatcher returned unexpected status: $($response.status)" -Level Error
            return $false
        }
    }
    catch {
        Write-Log "❌ Failed to connect to DonWatcher: $($_.Exception.Message)" -Level Error
        return $false
    }
}

function Get-DomainInformation {
    Write-Log "Collecting domain information..." -Level Info
    
    try {
        $domain = Get-ADDomain
        $forest = Get-ADForest
        $dcs = Get-ADDomainController -Filter *
        
        # Get user count with limit
        Write-Log "Counting users (max: $($Config.MaxUsers))..." -Level Debug
        $userCount = (Get-ADUser -Filter * -ResultSetSize $Config.MaxUsers | Measure-Object).Count
        if ($userCount -eq $Config.MaxUsers) {
            Write-Log "User count reached limit of $($Config.MaxUsers), actual count may be higher" -Level Warning
        }
        
        # Get computer count with limit
        Write-Log "Counting computers (max: $($Config.MaxComputers))..." -Level Debug
        $computerCount = (Get-ADComputer -Filter * -ResultSetSize $Config.MaxComputers | Measure-Object).Count
        if ($computerCount -eq $Config.MaxComputers) {
            Write-Log "Computer count reached limit of $($Config.MaxComputers), actual count may be higher" -Level Warning
        }
        
        $domainInfo = @{
            domain = $domain.DNSRoot
            domain_sid = $domain.DomainSID.Value
            domain_functional_level = $domain.DomainMode.ToString()
            forest_functional_level = $forest.ForestMode.ToString()
            dc_count = $dcs.Count
            user_count = $userCount
            computer_count = $computerCount
            netbios_name = $domain.NetBIOSName
            forest_root = $forest.RootDomain
        }
        
        Write-Log "Domain info collected successfully" -Level Debug
        return $domainInfo
    }
    catch {
        Write-Log "Failed to collect domain information: $($_.Exception.Message)" -Level Error
        throw
    }
}

function Get-PrivilegedGroupMemberships {
    Write-Log "Scanning privileged groups..." -Level Info
    
    $groupMemberships = @{}
    
    foreach ($groupName in $Config.PrivilegedGroups) {
        Write-Log "Scanning group: $groupName" -Level Debug
        
        try {
            $members = @()
            $adGroup = Get-ADGroup -Identity $groupName -ErrorAction SilentlyContinue
            
            if ($adGroup) {
                $groupMembers = Get-ADGroupMember -Identity $groupName -Recursive -ErrorAction SilentlyContinue
                
                foreach ($member in $groupMembers) {
                    try {
                        $memberDetails = Get-ADObject -Identity $member.SID -Properties Name, SID, ObjectClass, Enabled -ErrorAction SilentlyContinue
                        
                        $memberInfo = @{
                            name = $memberDetails.Name
                            sid = $memberDetails.SID.Value
                            type = $memberDetails.ObjectClass
                            enabled = if ($memberDetails.PSObject.Properties['Enabled']) { $memberDetails.Enabled } else { $true }
                        }
                        $members += $memberInfo
                    }
                    catch {
                        Write-Log "Failed to get details for member $($member.Name) in $groupName : $($_.Exception.Message)" -Level Warning
                    }
                }
                
                $groupMemberships[$groupName] = $members
                Write-Log "Group '$groupName': $($members.Count) members" -Level Debug
            }
            else {
                Write-Log "Group '$groupName' not found" -Level Warning
                $groupMemberships[$groupName] = @()
            }
        }
        catch {
            Write-Log "Failed to scan group '$groupName': $($_.Exception.Message)" -Level Warning
            $groupMemberships[$groupName] = @()
        }
    }
    
    $totalMembers = ($groupMemberships.Values | ForEach-Object { $_.Count } | Measure-Object -Sum).Sum
    Write-Log "Privileged group scan completed: $totalMembers total members across $($groupMemberships.Keys.Count) groups" -Level Info
    
    return $groupMemberships
}

function New-DomainAnalysisReport {
    param(
        [hashtable]$DomainInfo,
        [hashtable]$GroupMemberships
    )
    
    Write-Log "Creating domain analysis report..." -Level Debug
    
    # Generate unique report ID
    $reportId = [System.Guid]::NewGuid().ToString()
    $currentTime = Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ"
    
    # Create findings from group memberships
    $findings = @()
    
    foreach ($groupName in $GroupMemberships.Keys) {
        $members = $GroupMemberships[$groupName]
        
        if ($members.Count -gt 0) {
            $score = Get-GroupRiskScore -GroupName $groupName -MemberCount $members.Count
            $severity = Get-GroupSeverity -GroupName $groupName -MemberCount $members.Count
            
            $finding = @{
                id = [System.Guid]::NewGuid().ToString()
                report_id = $reportId
                tool_type = "domain_analysis"
                category = "DonScanner"
                name = "Group_$($groupName.Replace(' ', '_'))_Members"
                score = $score
                severity = $severity
                description = "Privileged group '$groupName' has $($members.Count) members"
                recommendation = "Review membership of privileged group '$groupName' and ensure all members require administrative access"
                metadata = @{
                    group_name = $groupName
                    member_count = $members.Count
                    members = $members
                }
            }
            $findings += $finding
        }
    }
    
    # Create the main report
    $report = @{
        id = $reportId
        tool_type = "domain_analysis"
        domain = $DomainInfo.domain
        report_date = $currentTime
        upload_date = $currentTime
        domain_sid = $DomainInfo.domain_sid
        domain_functional_level = $DomainInfo.domain_functional_level
        forest_functional_level = $DomainInfo.forest_functional_level
        dc_count = $DomainInfo.dc_count
        user_count = $DomainInfo.user_count
        computer_count = $DomainInfo.computer_count
        findings = $findings
        metadata = @{
            scan_type = "domain_analysis"
            agent_name = "powershell_domain_scanner"
            collection_method = "powershell_ldap"
            script_version = "1.0"
            collected_by = "$env:USERDOMAIN\$env:USERNAME"
            machine_name = $env:COMPUTERNAME
        }
    }
    
    Write-Log "Report created with $($findings.Count) findings" -Level Info
    return $report
}

function Get-GroupRiskScore {
    param(
        [string]$GroupName,
        [int]$MemberCount
    )
    
    # Base scores for different group types
    $groupScores = @{
        "Domain Admins" = 30
        "Enterprise Admins" = 35
        "Schema Admins" = 25
        "Administrators" = 20
        "Account Operators" = 15
        "Backup Operators" = 10
        "Server Operators" = 10
        "Print Operators" = 5
    }
    
    $baseScore = if ($groupScores.ContainsKey($GroupName)) { $groupScores[$GroupName] } else { 10 }
    
    # Increase score based on member count
    if ($MemberCount -gt 10) { $baseScore += 15 }
    elseif ($MemberCount -gt 5) { $baseScore += 10 }
    elseif ($MemberCount -gt 2) { $baseScore += 5 }
    
    return [Math]::Min($baseScore, 50)  # Cap at 50
}

function Get-GroupSeverity {
    param(
        [string]$GroupName,
        [int]$MemberCount
    )
    
    $highRiskGroups = @("Domain Admins", "Enterprise Admins", "Schema Admins")
    
    if ($GroupName -in $highRiskGroups) {
        if ($MemberCount -gt 5) { return "high" }
        elseif ($MemberCount -gt 2) { return "medium" }
        else { return "low" }
    }
    else {
        if ($MemberCount -gt 10) { return "medium" }
        else { return "low" }
    }
}

function Send-ReportToDonWatcher {
    param(
        [hashtable]$Report,
        [string]$BaseUrl
    )
    
    Write-Log "Sending report to DonWatcher..." -Level Info
    
    try {
        # Convert report to JSON
        $jsonReport = $Report | ConvertTo-Json -Depth 10 -Compress
        
        # Prepare headers
        $headers = @{
            "Content-Type" = "application/json"
            "User-Agent" = $Config.UserAgent
        }
        
        # Send to DonWatcher upload endpoint
        $uploadUrl = "$BaseUrl/upload"
        
        # Create a temporary file to simulate file upload
        $tempFile = [System.IO.Path]::GetTempFileName()
        $tempFile = [System.IO.Path]::ChangeExtension($tempFile, ".json")
        
        try {
            $jsonReport | Out-File -FilePath $tempFile -Encoding UTF8
            
            # Use Invoke-RestMethod with file upload
            $response = Invoke-RestMethod -Uri $uploadUrl -Method Post -InFile $tempFile -ContentType "application/json" -TimeoutSec $Config.TimeoutSeconds
            
            Write-Log "✅ Report uploaded successfully!" -Level Info
            Write-Log "Report ID: $($response.report_id)" -Level Info
            Write-Log "Tool Type: $($response.tool_type)" -Level Info
            Write-Log "Message: $($response.message)" -Level Info
            
            return $true
        }
        finally {
            # Clean up temp file
            if (Test-Path $tempFile) {
                Remove-Item $tempFile -Force
            }
        }
    }
    catch {
        Write-Log "❌ Failed to upload report: $($_.Exception.Message)" -Level Error
        return $false
    }
}
#endregion

#region Main Execution
function Main {
    Write-Log "🔍 DonWatcher Domain Scanner Starting..." -Level Info
    Write-Log "Version: 1.0" -Level Info
    Write-Log "Machine: $env:COMPUTERNAME" -Level Info
    Write-Log "User: $env:USERDOMAIN\$env:USERNAME" -Level Info
    
    try {
        # Check prerequisites
        if (-not (Test-Prerequisites)) {
            Write-Log "❌ Prerequisites check failed" -Level Error
            exit 1
        }
        
        # Test connection to DonWatcher
        if (-not (Test-DonWatcherConnection -BaseUrl $Config.DonWatcherUrl)) {
            Write-Log "❌ Cannot connect to DonWatcher" -Level Error
            exit 1
        }
        
        # If only testing connection, exit here
        if ($TestConnection) {
            Write-Log "✅ Connection test completed successfully" -Level Info
            exit 0
        }
        
        # Collect domain information
        $domainInfo = Get-DomainInformation
        
        # Collect privileged group memberships
        $groupMemberships = Get-PrivilegedGroupMemberships
        
        # Create report
        $report = New-DomainAnalysisReport -DomainInfo $domainInfo -GroupMemberships $groupMemberships
        
        # Send report to DonWatcher
        if (Send-ReportToDonWatcher -Report $report -BaseUrl $Config.DonWatcherUrl) {
            Write-Log "✅ Domain scan completed successfully!" -Level Info
            exit 0
        }
        else {
            Write-Log "❌ Failed to send report to DonWatcher" -Level Error
            exit 1
        }
    }
    catch {
        Write-Log "❌ Fatal error: $($_.Exception.Message)" -Level Error
        Write-Log "Stack trace: $($_.ScriptStackTrace)" -Level Debug
        exit 1
    }
}

# Create default config file if it doesn't exist
if (-not (Test-Path $ConfigFile)) {
    Write-Log "Creating default configuration file: $ConfigFile" -Level Info
    $DefaultConfig | ConvertTo-Json -Depth 3 | Out-File $ConfigFile -Encoding UTF8
    Write-Log "Please review and customize the configuration file before running again" -Level Info
}

# Run main function
Main
#endregion

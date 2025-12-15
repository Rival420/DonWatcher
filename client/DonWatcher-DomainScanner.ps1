#Requires -Modules ActiveDirectory
<#
.SYNOPSIS
    DonWatcher Domain Group Scanner - Minimal & Focused
    
.DESCRIPTION
    Collects privileged AD group memberships and uploads to DonWatcher.
    
    Features:
    - Scans only configured privileged groups
    - Reports group members with name, SID, type, and enabled status
    - Domain SID verification to ensure correct domain targeting
    - JSON config for easy customization
    - Designed for scheduled task execution
    
.PARAMETER DonWatcherUrl
    URL of the DonWatcher server (e.g., http://donwatcher:8080)
    
.PARAMETER ConfigFile
    Path to JSON configuration file (default: DonWatcher-Config.json)
    
.PARAMETER TestConnection
    Only test connectivity to DonWatcher, do not scan

.EXAMPLE
    .\DonWatcher-DomainScanner.ps1 -DonWatcherUrl "http://donwatcher:8080"
    
.EXAMPLE
    .\DonWatcher-DomainScanner.ps1 -TestConnection
    
.NOTES
    Requires: Active Directory PowerShell module (RSAT-AD-PowerShell)
    Version: 2.0
    Author: Donwatcher Development Team
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$DonWatcherUrl,

    [Parameter(Mandatory = $false)]
    [string]$ConfigFile = "DonWatcher-Config.json",

    [Parameter(Mandatory = $false)]
    [switch]$TestConnection
)

$ErrorActionPreference = "Stop"

# =============================================================================
# Configuration
# =============================================================================

$DefaultConfig = @{
    DonWatcherUrl    = "http://localhost:8080"
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
    TimeoutSeconds   = 120
}

function Load-Configuration {
    param([string]$Path)
    
    $config = $DefaultConfig.Clone()
    
    if (Test-Path $Path) {
        try {
            $fileConfig = Get-Content $Path -Raw | ConvertFrom-Json
            foreach ($prop in $fileConfig.PSObject.Properties) {
                $config[$prop.Name] = $prop.Value
            }
            Write-Verbose "Loaded configuration from: $Path"
        }
        catch {
            Write-Warning "Failed to load config file: $($_.Exception.Message). Using defaults."
        }
    }
    else {
        # Create default config file for user to customize
        Write-Host "[INFO] Creating default configuration file: $Path" -ForegroundColor Cyan
        @{
            DonWatcherUrl    = $config.DonWatcherUrl
            PrivilegedGroups = $config.PrivilegedGroups
            TimeoutSeconds   = $config.TimeoutSeconds
            # Optional: Uncomment and set to enforce domain SID matching
            # ExpectedDomainSID = "S-1-5-21-XXXXXXXXXX-XXXXXXXXXX-XXXXXXXXXX"
        } | ConvertTo-Json -Depth 3 | Out-File $Path -Encoding UTF8
        Write-Host "[INFO] Edit $Path to customize groups and settings" -ForegroundColor Yellow
    }
    
    return $config
}

# Load configuration
$Config = Load-Configuration -Path $ConfigFile

# Override URL from parameter if provided
if ($DonWatcherUrl) {
    $Config.DonWatcherUrl = $DonWatcherUrl
}

# =============================================================================
# Prerequisites Check
# =============================================================================

function Test-Prerequisites {
    Write-Verbose "Checking prerequisites..."
    
    # Check domain membership
    try {
        $cs = Get-WmiObject Win32_ComputerSystem -ErrorAction Stop
        if (-not $cs.Domain -or $cs.Domain -eq "WORKGROUP") {
            Write-Host "[ERROR] This machine is not domain-joined" -ForegroundColor Red
            return $false
        }
        Write-Verbose "Domain: $($cs.Domain)"
    }
    catch {
        Write-Host "[ERROR] Cannot detect domain: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
    
    # Check AD module
    try {
        Import-Module ActiveDirectory -ErrorAction Stop
        Write-Verbose "Active Directory module loaded"
    }
    catch {
        Write-Host "[ERROR] Active Directory module not available" -ForegroundColor Red
        Write-Host "[ERROR] Install RSAT-AD-PowerShell feature" -ForegroundColor Red
        return $false
    }
    
    return $true
}

# =============================================================================
# DonWatcher Connection
# =============================================================================

function Test-DonWatcherConnection {
    param([string]$BaseUrl)
    
    $statusUrl = "$BaseUrl/api/debug/status"
    Write-Host "[INFO] Testing connection to: $BaseUrl" -ForegroundColor Cyan
    
    try {
        $response = Invoke-RestMethod -Uri $statusUrl -Method Get -TimeoutSec 30 -UseBasicParsing
        Write-Host "[OK] Connected to DonWatcher" -ForegroundColor Green
        Write-Host "     Server Status    : $($response.status)" -ForegroundColor Gray
        Write-Host "     Reports in DB    : $($response.reports_count)" -ForegroundColor Gray
        Write-Host "     Parsers Loaded   : $($response.parsers_registered)" -ForegroundColor Gray
        return $response
    }
    catch {
        Write-Host "[ERROR] Cannot connect to DonWatcher: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# =============================================================================
# Domain SID Verification
# =============================================================================

function Get-DomainSID {
    $domain = Get-ADDomain -ErrorAction Stop
    return @{
        DomainName = $domain.DNSRoot
        DomainSID  = $domain.DomainSID.Value
        NetBIOS    = $domain.NetBIOSName
    }
}

function Test-DomainSIDMatch {
    param(
        [string]$ActualSID,
        [string]$ExpectedSID
    )
    
    if ([string]::IsNullOrWhiteSpace($ExpectedSID)) {
        Write-Verbose "No expected SID configured - skipping verification"
        return $true
    }
    
    if ($ActualSID -ne $ExpectedSID) {
        Write-Host "[ERROR] Domain SID mismatch!" -ForegroundColor Red
        Write-Host "        Actual:   $ActualSID" -ForegroundColor Red
        Write-Host "        Expected: $ExpectedSID" -ForegroundColor Red
        return $false
    }
    
    Write-Host "[OK] Domain SID verified" -ForegroundColor Green
    return $true
}

# =============================================================================
# Group Membership Collection
# =============================================================================

function Get-MemberEnabledStatus {
    param(
        [string]$ObjectClass,
        [string]$DistinguishedName
    )
    
    try {
        switch ($ObjectClass) {
            'user' {
                return (Get-ADUser -Identity $DistinguishedName -Properties Enabled -ErrorAction Stop).Enabled
            }
            'computer' {
                return (Get-ADComputer -Identity $DistinguishedName -Properties Enabled -ErrorAction Stop).Enabled
            }
            default {
                return $null  # Groups, contacts, etc. don't have Enabled property
            }
        }
    }
    catch {
        Write-Verbose "Cannot get Enabled status for $ObjectClass $DistinguishedName"
        return $null
    }
}

function Get-GroupMemberships {
    param([string[]]$Groups)
    
    Write-Host "[INFO] Scanning $($Groups.Count) privileged groups..." -ForegroundColor Cyan
    $result = @{}
    
    foreach ($groupName in $Groups) {
        Write-Host "     Scanning: $groupName" -ForegroundColor Gray -NoNewline
        $members = @()
        
        try {
            # Check if group exists
            $adGroup = Get-ADGroup -Identity $groupName -ErrorAction SilentlyContinue
            if (-not $adGroup) {
                Write-Host " -> NOT FOUND" -ForegroundColor Yellow
                $result[$groupName] = @()
                continue
            }
            
            # Get recursive members
            $groupMembers = Get-ADGroupMember -Identity $groupName -Recursive -ErrorAction SilentlyContinue
            
            foreach ($member in $groupMembers) {
                try {
                    # Get full object details
                    $obj = Get-ADObject -Identity $member.DistinguishedName `
                        -Properties Name, sAMAccountName, objectSID, objectClass `
                        -ErrorAction SilentlyContinue
                    
                    if (-not $obj) { continue }
                    
                    $enabled = Get-MemberEnabledStatus -ObjectClass $obj.objectClass `
                        -DistinguishedName $member.DistinguishedName
                    
                    $members += @{
                        name           = $obj.Name
                        samaccountname = $obj.sAMAccountName
                        sid            = $obj.objectSID.Value
                        type           = $obj.objectClass
                        enabled        = $enabled
                    }
                }
                catch {
                    Write-Verbose "Skipped member: $($member.Name) - $($_.Exception.Message)"
                }
            }
            
            $result[$groupName] = $members
            Write-Host " -> $($members.Count) members" -ForegroundColor White
        }
        catch {
            Write-Host " -> ERROR" -ForegroundColor Red
            Write-Warning "Error processing group '$groupName': $($_.Exception.Message)"
            $result[$groupName] = @()
        }
    }
    
    return $result
}

# =============================================================================
# Report Generation
# =============================================================================

function New-ScanReport {
    param(
        [hashtable]$DomainInfo,
        [hashtable]$GroupsData
    )
    
    return @{
        tool_type   = "domain_group_members"
        domain      = $DomainInfo.DomainName
        domain_sid  = $DomainInfo.DomainSID
        report_date = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ")
        groups      = $GroupsData
        metadata    = @{
            agent_name        = "donwatcher_domain_scanner"
            collection_method = "powershell_ad"
            script_version    = "2.0"
            collected_by      = "$env:USERDOMAIN\$env:USERNAME"
            machine_name      = $env:COMPUTERNAME
        }
    }
}

# =============================================================================
# Upload to DonWatcher
# =============================================================================

function Send-ReportToDonWatcher {
    param(
        [hashtable]$Report,
        [string]$BaseUrl,
        [int]$TimeoutSeconds = 120
    )
    
    $uploadUrl = "$BaseUrl/upload"
    Write-Host "[INFO] Uploading report to: $uploadUrl" -ForegroundColor Cyan
    
    $tempFile = $null
    $jsonFile = $null
    try {
        # Convert to JSON
        $jsonContent = $Report | ConvertTo-Json -Depth 10
        
        # Create temp file for upload
        $tempFile = [System.IO.Path]::GetTempFileName()
        $jsonFile = [System.IO.Path]::ChangeExtension($tempFile, ".json")
        $jsonContent | Out-File -FilePath $jsonFile -Encoding UTF8
        
        # Build multipart form data
        $boundary = [System.Guid]::NewGuid().ToString()
        $fileName = "domain-groups-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
        $LF = "`r`n"
        
        $body = @(
            "--$boundary",
            "Content-Disposition: form-data; name=`"file`"; filename=`"$fileName`"",
            "Content-Type: application/json$LF",
            $jsonContent,
            "--$boundary--$LF"
        ) -join $LF
        
        # Upload
        $null = Invoke-RestMethod -Uri $uploadUrl -Method Post `
            -ContentType "multipart/form-data; boundary=$boundary" `
            -Body $body -TimeoutSec $TimeoutSeconds
        
        Write-Host "[OK] Report uploaded successfully" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "[ERROR] Upload failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
    finally {
        # Cleanup temp files
        if ($tempFile -and (Test-Path $tempFile)) {
            Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
        }
        if ($jsonFile -and (Test-Path $jsonFile)) {
            Remove-Item $jsonFile -Force -ErrorAction SilentlyContinue
        }
    }
}

# =============================================================================
# Main Execution
# =============================================================================

function Main {
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host " DonWatcher Domain Group Scanner v2.0" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Show configuration summary
    Write-Host "[INFO] Configuration:" -ForegroundColor Cyan
    Write-Host "     Config File      : $ConfigFile" -ForegroundColor Gray
    Write-Host "     Target Server    : $($Config.DonWatcherUrl)" -ForegroundColor Gray
    Write-Host "     Groups to Scan   : $($Config.PrivilegedGroups.Count)" -ForegroundColor Gray
    Write-Host ""
    
    # Step 1: Check prerequisites
    if (-not (Test-Prerequisites)) {
        exit 1
    }
    
    # Step 2: Test DonWatcher connection
    $dwStatus = Test-DonWatcherConnection -BaseUrl $Config.DonWatcherUrl
    if (-not $dwStatus) {
        exit 1
    }
    
    # If only testing connection, exit here
    if ($TestConnection) {
        Write-Host ""
        Write-Host "[SUCCESS] Connection test completed" -ForegroundColor Green
        exit 0
    }
    
    # Step 3: Get domain information
    Write-Host "[INFO] Retrieving domain information..." -ForegroundColor Cyan
    try {
        $domainInfo = Get-DomainSID
        Write-Host "[OK] Domain: $($domainInfo.DomainName)" -ForegroundColor Green
        Write-Verbose "Domain SID: $($domainInfo.DomainSID)"
    }
    catch {
        Write-Host "[ERROR] Cannot get domain info: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
    
    # Step 4: Verify Domain SID
    $expectedSID = $null
    if ($Config.ContainsKey('ExpectedDomainSID') -and $Config.ExpectedDomainSID) {
        $expectedSID = $Config.ExpectedDomainSID
    }
    
    if (-not (Test-DomainSIDMatch -ActualSID $domainInfo.DomainSID -ExpectedSID $expectedSID)) {
        Write-Host "[ERROR] Domain SID verification failed. Aborting." -ForegroundColor Red
        exit 1
    }
    
    # Step 5: Collect group memberships
    $groupsData = Get-GroupMemberships -Groups $Config.PrivilegedGroups
    
    $totalMembers = ($groupsData.Values | ForEach-Object { $_.Count } | Measure-Object -Sum).Sum
    $groupCount = $groupsData.Keys.Count
    Write-Host "[OK] Collected $totalMembers members from $groupCount groups" -ForegroundColor Green
    
    # Step 6: Generate report
    $report = New-ScanReport -DomainInfo $domainInfo -GroupsData $groupsData
    
    # Step 7: Upload to DonWatcher
    if (Send-ReportToDonWatcher -Report $report -BaseUrl $Config.DonWatcherUrl -TimeoutSeconds $Config.TimeoutSeconds) {
        Write-Host ""
        Write-Host "[SUCCESS] Domain scan completed successfully" -ForegroundColor Green
        exit 0
    }
    else {
        Write-Host ""
        Write-Host "[ERROR] Domain scan completed but upload failed" -ForegroundColor Red
        exit 1
    }
}

# Run main
Main

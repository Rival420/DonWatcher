#Requires -Modules ActiveDirectory
<#
.SYNOPSIS
    DonWatcher Domain Group Scanner v3.0
    
.DESCRIPTION
    Scans privileged AD group memberships and uploads directly to DonWatcher API.
    
    Uses the dedicated /api/upload/domain-groups endpoint for reliable uploads.
    Direct JSON API - no file handling, no encoding issues.
    
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
    Version: 3.0
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
            $fileConfig = Get-Content $Path -Raw -Encoding UTF8 | ConvertFrom-Json
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
        Write-Host "[INFO] Creating default configuration file: $Path" -ForegroundColor Cyan
        @{
            DonWatcherUrl    = $config.DonWatcherUrl
            PrivilegedGroups = $config.PrivilegedGroups
            TimeoutSeconds   = $config.TimeoutSeconds
        } | ConvertTo-Json -Depth 3 | Out-File $Path -Encoding UTF8
        Write-Host "[INFO] Edit $Path to customize groups and settings" -ForegroundColor Yellow
    }
    
    return $config
}

$Config = Load-Configuration -Path $ConfigFile
if ($DonWatcherUrl) { $Config.DonWatcherUrl = $DonWatcherUrl }

# =============================================================================
# Prerequisites & Connection
# =============================================================================

function Test-Prerequisites {
    try {
        $cs = Get-WmiObject Win32_ComputerSystem -ErrorAction Stop
        if (-not $cs.Domain -or $cs.Domain -eq "WORKGROUP") {
            Write-Host "[ERROR] This machine is not domain-joined" -ForegroundColor Red
            return $false
        }
    }
    catch {
        Write-Host "[ERROR] Cannot detect domain: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
    
    try {
        Import-Module ActiveDirectory -ErrorAction Stop
    }
    catch {
        Write-Host "[ERROR] Active Directory module not available. Install RSAT-AD-PowerShell" -ForegroundColor Red
        return $false
    }
    
    return $true
}

function Test-DonWatcherConnection {
    param([string]$BaseUrl)
    
    Write-Host "[INFO] Testing connection to: $BaseUrl" -ForegroundColor Cyan
    
    try {
        $response = Invoke-RestMethod -Uri "$BaseUrl/api/debug/status" -Method Get -TimeoutSec 30
        Write-Host "[OK] Connected to DonWatcher" -ForegroundColor Green
        Write-Host "     Server Status    : $($response.status)" -ForegroundColor Gray
        Write-Host "     Reports in DB    : $($response.reports_count)" -ForegroundColor Gray
        return $response
    }
    catch {
        Write-Host "[ERROR] Cannot connect to DonWatcher: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# =============================================================================
# Domain & Group Collection
# =============================================================================

function Get-DomainInfo {
    $domain = Get-ADDomain -ErrorAction Stop
    return @{
        DomainName = $domain.DNSRoot
        DomainSID  = $domain.DomainSID.Value
    }
}

function Get-MemberEnabled {
    param([string]$ObjectClass, [string]$DN)
    try {
        switch ($ObjectClass) {
            'user'     { return (Get-ADUser -Identity $DN -Properties Enabled -ErrorAction Stop).Enabled }
            'computer' { return (Get-ADComputer -Identity $DN -Properties Enabled -ErrorAction Stop).Enabled }
            default    { return $null }
        }
    }
    catch { return $null }
}

function Get-GroupMemberships {
    param([string[]]$Groups)
    
    Write-Host "[INFO] Scanning $($Groups.Count) privileged groups..." -ForegroundColor Cyan
    $result = @()
    
    foreach ($groupName in $Groups) {
        Write-Host "     Scanning: $groupName" -ForegroundColor Gray -NoNewline
        
        try {
            $adGroup = Get-ADGroup -Identity $groupName -ErrorAction SilentlyContinue
            if (-not $adGroup) {
                Write-Host " -> NOT FOUND" -ForegroundColor Yellow
                continue
            }
            
            $members = @()
            $groupMembers = Get-ADGroupMember -Identity $groupName -Recursive -ErrorAction SilentlyContinue
            
            foreach ($m in $groupMembers) {
                try {
                    $obj = Get-ADObject -Identity $m.DistinguishedName `
                        -Properties Name, sAMAccountName, objectSID, objectClass -ErrorAction SilentlyContinue
                    
                    if ($obj) {
                        $members += [PSCustomObject]@{
                            name           = [string]$obj.Name
                            samaccountname = [string]$obj.sAMAccountName
                            sid            = if ($obj.objectSID) { [string]$obj.objectSID.Value } else { "" }
                            type           = [string]$obj.objectClass
                            enabled        = Get-MemberEnabled -ObjectClass $obj.objectClass -DN $m.DistinguishedName
                        }
                    }
                }
                catch { Write-Verbose "Skipped member: $($m.Name)" }
            }
            
            $result += [PSCustomObject]@{
                group_name = $groupName
                members    = $members
            }
            
            Write-Host " -> $($members.Count) members" -ForegroundColor White
        }
        catch {
            Write-Host " -> ERROR: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    return $result
}

# =============================================================================
# API Upload (Direct JSON - No File Handling)
# =============================================================================

function Send-ToApi {
    param(
        [string]$BaseUrl,
        [string]$Domain,
        [string]$DomainSID,
        [array]$Groups,
        [int]$TimeoutSeconds
    )
    
    # Use the dedicated domain-groups API endpoint
    $apiUrl = "$BaseUrl/api/upload/domain-groups"
    $fullUrl = "${apiUrl}?domain=$([uri]::EscapeDataString($Domain))"
    Write-Host "[INFO] Uploading via API: $apiUrl" -ForegroundColor Cyan
    
    # Build request body matching API schema (APIGroupData model)
    $requestBody = @{
        groups = $Groups
        domain_metadata = @{
            domain_sid = $DomainSID
        }
    }
    
    # Convert to JSON with proper encoding
    $jsonBody = $requestBody | ConvertTo-Json -Depth 10 -Compress
    
    # Encode as UTF-8 bytes for proper handling of international characters
    $utf8Bytes = [System.Text.Encoding]::UTF8.GetBytes($jsonBody)
    
    try {
        $response = Invoke-RestMethod -Uri $fullUrl -Method Post `
            -ContentType "application/json; charset=utf-8" `
            -Body $utf8Bytes `
            -TimeoutSec $TimeoutSeconds
        
        Write-Host "[OK] Upload successful" -ForegroundColor Green
        Write-Host "     Report ID        : $($response.report_id)" -ForegroundColor Gray
        Write-Host "     Tool Type        : $($response.tool_type)" -ForegroundColor Gray
        Write-Host "     Groups Processed : $($response.groups_processed)" -ForegroundColor Gray
        Write-Host "     Findings Created : $($response.findings_count)" -ForegroundColor Gray
        return $true
    }
    catch {
        $errorMsg = $_.Exception.Message
        
        # Try to extract detailed error from response
        if ($_.Exception.Response) {
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                $reader = [System.IO.StreamReader]::new($stream)
                $responseBody = $reader.ReadToEnd()
                $reader.Close()
                if ($responseBody) {
                    $errorDetail = $responseBody | ConvertFrom-Json -ErrorAction SilentlyContinue
                    if ($errorDetail.detail) {
                        $errorMsg = "$errorMsg - $($errorDetail.detail)"
                    }
                }
            }
            catch {}
        }
        
        Write-Host "[ERROR] Upload failed: $errorMsg" -ForegroundColor Red
        return $false
    }
}

# =============================================================================
# Main
# =============================================================================

function Main {
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host " DonWatcher Domain Group Scanner v3.0" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "[INFO] Configuration:" -ForegroundColor Cyan
    Write-Host "     Config File      : $ConfigFile" -ForegroundColor Gray
    Write-Host "     Target Server    : $($Config.DonWatcherUrl)" -ForegroundColor Gray
    Write-Host "     Groups to Scan   : $($Config.PrivilegedGroups.Count)" -ForegroundColor Gray
    Write-Host "     API Endpoint     : /api/upload/domain-groups" -ForegroundColor Gray
    Write-Host ""
    
    if (-not (Test-Prerequisites)) { exit 1 }
    
    $dwStatus = Test-DonWatcherConnection -BaseUrl $Config.DonWatcherUrl
    if (-not $dwStatus) { exit 1 }
    
    if ($TestConnection) {
        Write-Host "`n[SUCCESS] Connection test completed" -ForegroundColor Green
        exit 0
    }
    
    # Get domain info
    Write-Host "[INFO] Retrieving domain information..." -ForegroundColor Cyan
    try {
        $domainInfo = Get-DomainInfo
        Write-Host "[OK] Domain: $($domainInfo.DomainName)" -ForegroundColor Green
        Write-Host "     Domain SID       : $($domainInfo.DomainSID)" -ForegroundColor Gray
    }
    catch {
        Write-Host "[ERROR] Cannot get domain info: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
    
    # Verify domain SID if configured
    if ($Config.ExpectedDomainSID -and $Config.ExpectedDomainSID -ne $domainInfo.DomainSID) {
        Write-Host "[ERROR] Domain SID mismatch!" -ForegroundColor Red
        Write-Host "        Expected: $($Config.ExpectedDomainSID)" -ForegroundColor Red
        Write-Host "        Actual:   $($domainInfo.DomainSID)" -ForegroundColor Red
        exit 1
    }
    
    # Collect groups
    $groups = Get-GroupMemberships -Groups $Config.PrivilegedGroups
    $totalMembers = ($groups | ForEach-Object { $_.members.Count } | Measure-Object -Sum).Sum
    Write-Host "[OK] Collected $totalMembers members from $($groups.Count) groups" -ForegroundColor Green
    
    # Upload via dedicated API endpoint
    if (Send-ToApi -BaseUrl $Config.DonWatcherUrl `
                   -Domain $domainInfo.DomainName `
                   -DomainSID $domainInfo.DomainSID `
                   -Groups $groups `
                   -TimeoutSeconds $Config.TimeoutSeconds) {
        Write-Host "`n[SUCCESS] Domain scan completed successfully" -ForegroundColor Green
        exit 0
    }
    else {
        Write-Host "`n[ERROR] Domain scan completed but upload failed" -ForegroundColor Red
        exit 1
    }
}

Main

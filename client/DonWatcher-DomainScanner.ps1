#Requires -Modules ActiveDirectory
<#
.SYNOPSIS
    DonWatcher Domain Scanner Agent (Minimal)
.DESCRIPTION
    Collects only:
      - Domain SID
      - Configured groups and their members (name, samaccountname, sid, type, enabled)
    Optional domain SID mismatch enforcement.
    Uploads JSON via multipart/form-data to DonWatcher /upload.
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
    [switch]$TestConnection
)

$ErrorActionPreference = "Stop"

#region Configuration
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
    TimeoutSeconds = 300
    UserAgent = "DonWatcher-DomainScanner/1.0"
    LogLevel = "Info"
    # Optional: ExpectedDomainSID = "S-1-5-21-..."
}

$Config = $DefaultConfig.Clone()
if (Test-Path $ConfigFile) {
    try {
        Write-Verbose "Loading configuration from: $ConfigFile"
        $FileConfig = Get-Content $ConfigFile -Raw | ConvertFrom-Json
        foreach ($key in $FileConfig.PSObject.Properties.Name) {
            $Config[$key] = $FileConfig.$key
        }
    }
    catch {
        Write-Warning "Failed to load config file '$ConfigFile': $($_.Exception.Message)"
        Write-Warning "Using default configuration"
    }
}

if ($DonWatcherUrl) { $Config.DonWatcherUrl = $DonWatcherUrl }
if ($Groups) { $Config.PrivilegedGroups = $Groups }
#endregion

#region Logging
function Write-Log {
    param(
        [string]$Message,
        [ValidateSet("Info","Warning","Error","Debug")]
        [string]$Level = "Info"
    )
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    switch ($Level) {
        "Info"    { Write-Host $logMessage -ForegroundColor Green }
        "Warning" { Write-Warning $logMessage }
        "Error"   { Write-Error $logMessage }
        "Debug"   { Write-Verbose $logMessage }
    }
}
#endregion

#region Helpers
function Test-Prerequisites {
    Write-Log "Checking prerequisites..." -Level Debug
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

# Returns JSON status or $null
function Test-DonWatcherConnection {
    param([string]$BaseUrl)
    Write-Log "Testing connection to DonWatcher at: $BaseUrl" -Level Debug
    try {
        $statusUrl = "$BaseUrl/api/debug/status"
        $response = Invoke-RestMethod -Uri $statusUrl -Method Get -TimeoutSec 30 -UseBasicParsing
        Write-Log "[OK] DonWatcher connection successful" -Level Info
        return $response
    }
    catch {
        Write-Log "[ERROR] Failed to connect to DonWatcher: $($_.Exception.Message)" -Level Error
        return $null
    }
}

function Get-DomainInfoMinimal {
    Write-Log "Collecting minimal domain info (SID)..." -Level Info
    $domain = Get-ADDomain -ErrorAction Stop
    if (-not $domain.DomainSID) { throw "Unable to retrieve DomainSID" }
    return @{
        domain     = $domain.DNSRoot
        domain_sid = $domain.DomainSID.Value
        netbios    = $domain.NetBIOSName
    }
}

function Resolve-MemberEnabled {
    param(
        [string]$ObjectClass,
        [string]$DistinguishedName
    )
    try {
        switch ($ObjectClass) {
            'user'     { return (Get-ADUser -Identity $DistinguishedName -Properties Enabled -ErrorAction Stop).Enabled }
            'computer' { return (Get-ADComputer -Identity $DistinguishedName -Properties Enabled -ErrorAction Stop).Enabled }
            default    { return $null } # groups, contacts, etc. -> not applicable
        }
    }
    catch {
        Write-Log "Failed to resolve Enabled for $ObjectClass : $DistinguishedName : $($_.Exception.Message)" -Level Warning
        return $null
    }
}

function Get-ConfiguredGroupMemberships {
    Write-Log "Collecting group memberships..." -Level Info
    $result = @{}

    foreach ($groupName in $Config.PrivilegedGroups) {
        Write-Log "Group: $groupName" -Level Debug
        $membersArray = @()

        try {
            $adGroup = Get-ADGroup -Identity $groupName -ErrorAction SilentlyContinue
            if (-not $adGroup) {
                Write-Log "Group '$groupName' not found" -Level Warning
                $result[$groupName] = @()
                continue
            }

            $groupMembers = Get-ADGroupMember -Identity $groupName -Recursive -ErrorAction SilentlyContinue
            foreach ($m in $groupMembers) {
                try {
                    # Query a generic AD object + collect extra props if present
                    $obj = Get-ADObject -Identity $m.DistinguishedName -Properties Name, sAMAccountName, ObjectClass, objectSID -ErrorAction SilentlyContinue
                    if (-not $obj) { continue }

                    $enabled = Resolve-MemberEnabled -ObjectClass $obj.ObjectClass -DistinguishedName $m.DistinguishedName

                    $membersArray += @{
                        name           = $obj.Name
                        samaccountname = ($obj.PSObject.Properties['sAMAccountName']?.Value)
                        sid            = ($obj.PSObject.Properties['objectSID']?.Value)
                        type           = $obj.ObjectClass
                        enabled        = $enabled
                    }
                }
                catch {
                    Write-Log "Failed member detail for '$($m.Name)' in '$groupName': $($_.Exception.Message)" -Level Warning
                }
            }
            $result[$groupName] = $membersArray
            Write-Log "Collected $($membersArray.Count) member(s) for '$groupName'" -Level Debug
        }
        catch {
            Write-Log "Error processing group '$groupName': $($_.Exception.Message)" -Level Warning
            $result[$groupName] = @()
        }
    }

    return $result
}

function New-MinimalReportJson {
    param(
        [hashtable]$DomainInfo,
        [hashtable]$GroupsMap
    )

    # Simple, compliance-focused JSON:
    # {
    #   "tool_type": "domain_group_members",
    #   "domain": "corp.example.com",
    #   "domain_sid": "S-1-5-21-...",
    #   "report_date": "...",
    #   "groups": { "Domain Admins": [ {member...}, ... ], ... },
    #   "metadata": {...}
    # }
    $currentTime = Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ"
    return @{
        tool_type   = "domain_group_members"
        domain      = $DomainInfo.domain
        domain_sid  = $DomainInfo.domain_sid
        report_date = $currentTime
        groups      = $GroupsMap
        metadata    = @{
            agent_name        = "powershell_domain_scanner_minimal"
            collection_method = "powershell_ldap"
            script_version    = "1.0"
            collected_by      = "$env:USERDOMAIN\$env:USERNAME"
            machine_name      = $env:COMPUTERNAME
        }
    }
}

function Send-ReportToDonWatcher {
    param(
        [hashtable]$Report,
        [string]$BaseUrl
    )

    Write-Log "Uploading JSON report to DonWatcher..." -Level Info

    $tempFile = [System.IO.Path]::GetTempFileName()
    $jsonFile = [System.IO.Path]::ChangeExtension($tempFile, ".json")

    try {
        $Report | ConvertTo-Json -Depth 10 | Out-File -FilePath $jsonFile -Encoding UTF8

        $uploadUrl = "$BaseUrl/upload"
        $boundary = [System.Guid]::NewGuid().ToString()
        $LF = "`r`n"

        $fileContent = Get-Content -Path $jsonFile -Raw
        $fileName = "domain-groups-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"

        $bodyLines = @(
            "--$boundary",
            "Content-Disposition: form-data; name=`"file`"; filename=`"$fileName`"",
            "Content-Type: application/json$LF",
            $fileContent,
            "--$boundary--$LF"
        ) -join $LF

        $null = Invoke-RestMethod -Uri $uploadUrl -Method Post -ContentType "multipart/form-data; boundary=$boundary" -Body $bodyLines -TimeoutSec $Config.TimeoutSeconds
        Write-Log "[SUCCESS] Report uploaded." -Level Info
        return $true
    }
    catch {
        Write-Log "[ERROR] Upload failed: $($_.Exception.Message)" -Level Error
        return $false
    }
    finally {
        if (Test-Path $tempFile) { Remove-Item $tempFile -Force -ErrorAction SilentlyContinue }
        if (Test-Path $jsonFile) { Remove-Item $jsonFile -Force -ErrorAction SilentlyContinue }
    }
}
#endregion

#region Main
function Main {
    Write-Log "DonWatcher Domain Scanner (Minimal) starting..." -Level Info

    try {
        if (-not (Test-Prerequisites)) {
            Write-Log "[ERROR] Prerequisites check failed" -Level Error
            exit 1
        }

        $dwStatus = Test-DonWatcherConnection -BaseUrl $Config.DonWatcherUrl
        if (-not $dwStatus -and -not $TestConnection) {
            Write-Log "[ERROR] Cannot connect to DonWatcher" -Level Error
            exit 1
        }

        if ($TestConnection) {
            Write-Log "[SUCCESS] Connection test completed" -Level Info
            exit 0
        }

        $domainInfo = Get-DomainInfoMinimal

        # Enforce domain SID, if an expected value is available
        $expectedSid = $null
        if ($Config.PSObject.Properties.Name -contains 'ExpectedDomainSID' -and $Config.ExpectedDomainSID) {
            $expectedSid = $Config.ExpectedDomainSID
            Write-Log "Using ExpectedDomainSID from config." -Level Debug
        } elseif ($dwStatus -and $dwStatus.domain_sid) {
            $expectedSid = $dwStatus.domain_sid
            Write-Log "Using domain_sid from DonWatcher status." -Level Debug
        }

        if ($expectedSid) {
            if ($expectedSid -ne $domainInfo.domain_sid) {
                Write-Log "[ERROR] Domain SID mismatch! AD: $($domainInfo.domain_sid) Expected: $expectedSid" -Level Error
                throw "Domain SID does not match expected value. Aborting."
            } else {
                Write-Log "Domain SID matches expected value." -Level Info
            }
        } else {
            Write-Log "No expected domain SID provided; skipping SID enforcement." -Level Warning
        }

        $groupsMap = Get-ConfiguredGroupMemberships

        $report = New-MinimalReportJson -DomainInfo $domainInfo -GroupsMap $groupsMap

        if (Send-ReportToDonWatcher -Report $report -BaseUrl $Config.DonWatcherUrl) {
            Write-Log "[SUCCESS] Minimal domain scan finished." -Level Info
            exit 0
        } else {
            Write-Log "[ERROR] Upload failed." -Level Error
            exit 1
        }
    }
    catch {
        Write-Log "[ERROR] Fatal: $($_.Exception.Message)" -Level Error
        Write-Log "Stack trace: $($_.ScriptStackTrace)" -Level Debug
        exit 1
    }
}

# Create a default config if missing (non-destructive if present)
if (-not (Test-Path $ConfigFile)) {
    Write-Log "Creating default configuration file: $ConfigFile" -Level Info
    $DefaultConfig | ConvertTo-Json -Depth 3 | Out-File $ConfigFile -Encoding UTF8
    Write-Log "Review and customize the configuration file before running again." -Level Info
}

Main
#endregion

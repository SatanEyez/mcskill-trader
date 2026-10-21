# mysql-connect.ps1 — консольный клиент MySQL с настройками из mysql-connection.env
#
# Запуск (двойной клик по mysql-connect.cmd или из терминала):
#   .\mysql-connect.cmd                 — интерактивная консоль SQL
#   .\mysql-connect.cmd -Query "SELECT COUNT(*) FROM resources;"
#
# Локальная MySQL — через mysql.exe. Облачная (MYSQL_SSL=true, например TiDB) —
# через mysql-cli.mjs на mysql2: mysql.exe 9.x не умеет mysql_native_password.
#
# Путь к mysql.exe можно переопределить переменной окружения MYSQL_BIN.

[CmdletBinding()]
param(
  [string]$ConfigFile,
  [string]$Query
)

$ErrorActionPreference = 'Stop'

$scriptDir = if ($PSScriptRoot) {
  $PSScriptRoot
} else {
  Split-Path -Parent $MyInvocation.MyCommand.Path
}

if (-not $ConfigFile) {
  $ConfigFile = Join-Path $scriptDir 'mysql-connection.env'
}

function Read-EnvFile {
  param([string]$Path)

  $values = @{}

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Не найден файл настроек: $Path"
  }

  foreach ($raw in Get-Content -LiteralPath $Path -Encoding UTF8) {
    $line = $raw.Trim()

    if ($line -eq '' -or $line.StartsWith('#')) { continue }

    $separator = $line.IndexOf('=')
    if ($separator -lt 1) { continue }

    $key = $line.Substring(0, $separator).Trim()
    $value = $line.Substring($separator + 1).Trim()

    # Снимаем обрамляющие кавычки: MYSQL_PASSWORD="my pass"
    if ($value.Length -ge 2) {
      $first = $value.Substring(0, 1)
      $last = $value.Substring($value.Length - 1, 1)

      if (($first -eq '"' -and $last -eq '"') -or ($first -eq "'" -and $last -eq "'")) {
        $value = $value.Substring(1, $value.Length - 2)
      }
    }

    $values[$key] = $value
  }

  return $values
}

function Find-MysqlClient {
  $candidates = @()

  if ($env:MYSQL_BIN) { $candidates += $env:MYSQL_BIN }

  $candidates += @(
    'C:\Users\<user>\mysql\mysql-9.4.0-winx64\bin\mysql.exe',
    'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe',
    'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe'
  )

  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) { return $candidate }
  }

  $command = Get-Command 'mysql.exe' -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }

  throw 'mysql.exe не найден. Укажите путь в переменной MYSQL_BIN или в списке Find-MysqlClient.'
}

$config = Read-EnvFile -Path $ConfigFile

$dbHost = if ($config['MYSQL_HOST']) { $config['MYSQL_HOST'] } else { '127.0.0.1' }
$dbPort = if ($config['MYSQL_PORT']) { $config['MYSQL_PORT'] } else { '3306' }
$dbUser = if ($config['MYSQL_USER']) { $config['MYSQL_USER'] } else { 'root' }
$dbPassword = if ($config.ContainsKey('MYSQL_PASSWORD')) { $config['MYSQL_PASSWORD'] } else { '' }
$dbName = if ($config['MYSQL_DATABASE']) { $config['MYSQL_DATABASE'] } else { 'mcskill_trader' }

# Облачная MySQL (MYSQL_SSL=true): mysql.exe 9.x не поддерживает
# mysql_native_password, которым пользуется TiDB, — работаем через mysql2.
if ($config['MYSQL_SSL'] -eq 'true') {
  $nodeScript = Join-Path $scriptDir 'mysql-cli.mjs'
  $nodeArguments = @($nodeScript)

  if ($Query) { $nodeArguments += @('--query', $Query) }

  & node @nodeArguments
  exit $LASTEXITCODE
}

$mysql = Find-MysqlClient

# Пароль передаём через временный option-файл, чтобы он не светился
# в списке процессов и не вызывал предупреждение mysql.exe.
$optionFile = Join-Path ([System.IO.Path]::GetTempPath()) ("mcskill-my-{0}.cnf" -f [Guid]::NewGuid())

$optionLines = @(
  '[client]',
  "host=$dbHost",
  "port=$dbPort",
  "user=$dbUser",
  "password=$dbPassword",
  'default-character-set=utf8mb4'
)

# Облачные MySQL пускают только по TLS.
if ($config['MYSQL_SSL'] -eq 'true') {
  $optionLines += 'ssl-mode=REQUIRED'
}

try {
  Set-Content -LiteralPath $optionFile -Value $optionLines -Encoding ASCII

  $arguments = @(
    "--defaults-extra-file=$optionFile",
    "--database=$dbName"
  )

  if ($Query) {
    $arguments += "--execute=$Query"
    & $mysql @arguments
    exit $LASTEXITCODE
  }

  Write-Host ''
  Write-Host "  MySQL: $dbUser@$dbHost`:$dbPort/$dbName" -ForegroundColor Cyan
  Write-Host '  Введите SQL и нажмите Enter. Выход — команда exit;' -ForegroundColor DarkGray
  Write-Host ''

  & $mysql @arguments
  exit $LASTEXITCODE
}
finally {
  Remove-Item -LiteralPath $optionFile -Force -ErrorAction SilentlyContinue
}

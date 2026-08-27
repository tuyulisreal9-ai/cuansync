param(
    [ValidateSet("Debug")]
    [string]$Configuration = "Debug"
)

$ErrorActionPreference = "Stop"
$cuanProjectRoot = Split-Path -Parent $PSScriptRoot
$cuanLocalJdk = Get-ChildItem -Path (Join-Path $cuanProjectRoot ".tooling") -Directory -Filter "jdk-21*" -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending |
    Select-Object -First 1
$cuanJavaHome = if ($env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME "bin\java.exe"))) {
    $env:JAVA_HOME
} elseif ($cuanLocalJdk) {
    $cuanLocalJdk.FullName
} else {
    throw "JDK 21 tidak ditemukan. Atur JAVA_HOME atau pasang JDK 21."
}

$cuanLocalSdk = Join-Path $cuanProjectRoot ".tooling\android-sdk"
$cuanSdkHome = if ($env:ANDROID_HOME -and (Test-Path $env:ANDROID_HOME)) {
    $env:ANDROID_HOME
} elseif (Test-Path $cuanLocalSdk) {
    $cuanLocalSdk
} else {
    throw "Android SDK tidak ditemukan. Atur ANDROID_HOME atau pasang SDK API 36."
}

$env:JAVA_HOME = $cuanJavaHome
$env:ANDROID_HOME = $cuanSdkHome
$env:GRADLE_USER_HOME = Join-Path $cuanProjectRoot ".tooling\gradle-home"
$cuanDefaultAndroidUserHome = Join-Path $env:USERPROFILE ".android"
$cuanLocalAndroidUserHome = Join-Path $cuanProjectRoot ".tooling\android-user"
$cuanAndroidUserHome = @(
    $cuanDefaultAndroidUserHome
    $cuanLocalAndroidUserHome
) | Where-Object {
    Test-Path (Join-Path $_ "debug.keystore")
} | Select-Object -First 1
if (-not $cuanAndroidUserHome) {
    throw "Debug keystore yang sudah ada tidak ditemukan. Build dihentikan agar tidak membuat signing key baru."
}
$env:ANDROID_USER_HOME = $cuanAndroidUserHome

$cuanAndroidRoot = Join-Path $cuanProjectRoot "android"
$cuanArtifactRoot = Join-Path $cuanProjectRoot "artifacts"
$cuanSourceApk = Join-Path $cuanAndroidRoot "app\build\outputs\apk\debug\app-debug.apk"
$cuanTargetApk = Join-Path $cuanArtifactRoot "CUANSYNC-debug.apk"

Push-Location $cuanAndroidRoot
try {
    & ".\gradlew.bat" "assemble$Configuration" --no-daemon
    if ($LASTEXITCODE -ne 0) {
        throw "Gradle gagal dengan exit code $LASTEXITCODE."
    }
} finally {
    Pop-Location
}

New-Item -ItemType Directory -Force -Path $cuanArtifactRoot | Out-Null
Copy-Item -LiteralPath $cuanSourceApk -Destination $cuanTargetApk -Force
$cuanHash = (Get-FileHash -LiteralPath $cuanTargetApk -Algorithm SHA256).Hash

Write-Output "APK selesai: $cuanTargetApk"
Write-Output "SHA-256: $cuanHash"

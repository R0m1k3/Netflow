# Script to package Netflow files for Unraid deployment
$ErrorActionPreference = "Stop"

$distDir = "netflow-unraid-pkg"
$zipName = "netflow-deployment.zip"

Write-Host "Cleaning up..."
if (Test-Path $distDir) { Remove-Item -Recurse -Force $distDir }
if (Test-Path $zipName) { Remove-Item -Force $zipName }

New-Item -ItemType Directory -Force -Path $distDir | Out-Null

Write-Host "Copying project files..."

# Copy Docker folder
Copy-Item -Recurse -Path "docker" -Destination "$distDir/docker"
# Copy Backend (excluding node_modules)
Copy-Item -Recurse -Path "backend" -Destination "$distDir/backend"
if (Test-Path "$distDir/backend/node_modules") { Remove-Item -Recurse -Force "$distDir/backend/node_modules" }
if (Test-Path "$distDir/backend/dist") { Remove-Item -Recurse -Force "$distDir/backend/dist" }

# Copy Frontend (excluding node_modules)
Copy-Item -Recurse -Path "web_frontend" -Destination "$distDir/web_frontend"
if (Test-Path "$distDir/web_frontend/node_modules") { Remove-Item -Recurse -Force "$distDir/web_frontend/node_modules" }
if (Test-Path "$distDir/web_frontend/dist") { Remove-Item -Recurse -Force "$distDir/web_frontend/dist" }

# Copy Configs
Copy-Item "docker-compose.prod.yml" -Destination "$distDir/docker-compose.yml"
Copy-Item "package.json" -Destination "$distDir/package.json"

Write-Host "Creating Archive..."
Compress-Archive -Path "$distDir/*" -DestinationPath $zipName

Write-Host "Done! Upload '$zipName' to your Unraid server at /boot/config/plugins/compose.manager/projects/Netflow/"
Write-Host "Then unzip it using: unzip netflow-deployment.zip"

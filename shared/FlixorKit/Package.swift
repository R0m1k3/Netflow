// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "NetflowKit",
    platforms: [
        .iOS(.v16),
        .tvOS(.v16),
        .macOS(.v13)
    ],
    products: [
        .library(name: "NetflowKit", targets: ["NetflowKit"])    
    ],
    targets: [
        .target(name: "NetflowKit", path: "Sources/FlixorKit")
    ]
)


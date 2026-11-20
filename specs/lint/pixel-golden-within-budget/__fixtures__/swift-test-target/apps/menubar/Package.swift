// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "Menubar",
    targets: [
        .target(name: "Kit", path: "sources/kit"),
        .testTarget(name: "KitTests", dependencies: ["Kit"], path: "tests/station-kit-tests"),
    ]
)

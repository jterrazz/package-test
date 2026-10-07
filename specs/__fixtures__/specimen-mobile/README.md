# Specimen — the app the mobile specs drive

Specimen is a native app small enough to hold in one head: a launch screen, a sign-in form, a notes list read from an API, and a drafts list with two `Delete` buttons and one button below the fold. It exists twice, kept screen for screen:

- **As data**, `specimen.ts` — what the Appium protocol double (`../../__setup__/appium/`) draws in every run of `make check`.
- **As a SwiftUI app**, `ios/` — what `make test-mobile` installs on a real iOS simulator.

A spec green on one and red on the other has found a gap between the double and a device: the double is corrected to answer as the device did, never the other way round.

## `make test-mobile`

`on-simulator.mjs` runs the same `specs/mobile/` files against the real thing, in five steps:

1. **Build** `ios/Specimen.swift` with `swiftc` and the simulator SDK into `.artifacts/mobile/Specimen.app` — no Xcode project — and sign it ad hoc.
2. **Boot** the simulator `specimen.ts` names (`simulator`) and wait until it is up.
3. **Install** the app on it.
4. **Start Appium** — pinned, installed once under `.artifacts/mobile/appium/` with its XCUITest driver — on a free port, logging to `.artifacts/mobile/appium.log`.
5. **Run** the `mobile` project with `TEST_MOBILE_APPIUM_URL` set to that server, which is what switches the runner from the double to the device.

It needs, on the machine:

| What                                      | Why                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------- |
| Xcode, its command-line tools selected    | `swiftc`, the simulator SDK, `simctl`, and the build of WebDriverAgent          |
| exactly one available `iPhone 17` on 26.5 | the device `simulator` names; the run refuses zero or several                   |
| network access on the first run           | npm installs Appium and the XCUITest driver, once                               |
| minutes on a simulator's first session    | WebDriverAgent is built then (about 75 s measured), and cached for later ones |

No CI job runs it, and `make check` never calls it: CI provisions no simulator. Run it before a release, and whenever `src/specifications/mobile/` or the double changes.

// Specimen — the app the mobile specs drive on a real simulator, the same
// Screens `../specimen.ts` describes as data for the protocol double. Keep
// The two screen for screen: a label, a type, an identifier or a transition
// That differs is a gap between the double and a device.
import SwiftUI

@main
struct SpecimenApp: App {
    @State private var screen = "home"
    @State private var api: String?
    @State private var email = ""
    @State private var password = ""

    var body: some Scene {
        WindowGroup {
            ScreenView(screen: $screen, api: api, email: $email, password: $password)
                .onOpenURL { url in
                    let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
                    api = components?.queryItems?.first { $0.name == "api" }?.value
                    screen = url.host ?? "home"
                }
        }
    }
}

struct ScreenView: View {
    @Binding var screen: String
    let api: String?
    @Binding var email: String
    @Binding var password: String

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            switch screen {
            case "sign-in":
                Text("Sign in")
                TextField("name@example.com", text: $email)
                    .accessibilityLabel("Email")
                    .accessibilityIdentifier("email")
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                SecureField("Required", text: $password)
                    .accessibilityLabel("Password")
                    .accessibilityIdentifier("password")
                Button("Continue") { screen = "signed-in" }
            case "signed-in":
                Text("Signed in as \(email)")
                Button("Sign out") { screen = "home" }
            case "notes":
                Text("Notes")
                NoteList(api: api)
            case "drafts":
                Drafts(screen: $screen)
            case "draft-deleted":
                Text("Draft deleted")
            case "archive-deleted":
                Text("Archived list deleted")
            case "older":
                Text("No older drafts")
            default:
                Text("Welcome to Specimen")
                Button("Sign in") { screen = "sign-in" }
            }
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

struct NoteList: View {
    let api: String?
    @State private var titles: [String]?
    @State private var failed = false

    var body: some View {
        VStack(alignment: .leading) {
            if failed {
                Text("Notes unavailable")
            }
            ForEach(titles ?? [], id: \.self) { Text($0) }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("note-list")
        .task { await load() }
    }

    private func load() async {
        guard let api, let url = URL(string: "\(api)/notes") else {
            failed = true
            return
        }
        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else {
                failed = true
                return
            }
            let notes = try JSONDecoder().decode([Note].self, from: data)
            titles = notes.map(\.title)
        } catch {
            failed = true
        }
    }
}

struct Note: Decodable {
    let title: String
}

struct Drafts: View {
    @Binding var screen: String

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Drafts")
                HStack {
                    Text("Groceries")
                    Button("Delete") { screen = "draft-deleted" }
                }
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier("draft-row")
                HStack {
                    Text("Old list")
                    Button("Delete") { screen = "archive-deleted" }
                }
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier("archive-row")
                Color.clear.frame(height: 2000)
                Button("Load older drafts") { screen = "older" }
            }
        }
    }
}

/**
 * A condensed excerpt of a REAL XCUITest page source, captured from an Expo
 * app on the iOS simulator (the `specification.mobile()` design spike). It
 * keeps every noise pattern the projection exists to collapse: the
 * `AppiumAUT` envelope, unlabeled `Other` wrapper towers, a StaticText
 * repeated as its own child, a bare Button wrapping an invisible empty
 * StaticText, and off-screen rows with `visible="false"`.
 */
export const EVENTS_SCREEN_SOURCE = `<?xml version="1.0" encoding="UTF-8"?>
<AppiumAUT>
  <XCUIElementTypeApplication type="XCUIElementTypeApplication" name="SigNews" label="SigNews" enabled="true" visible="true" accessible="false" x="0" y="0" width="402" height="874" index="0" traits="" processId="79757" bundleId="com.jterrazz.fakenews">
    <XCUIElementTypeWindow type="XCUIElementTypeWindow" enabled="true" visible="true" accessible="false" x="0" y="0" width="402" height="874" index="0" traits="">
      <XCUIElementTypeOther type="XCUIElementTypeOther" enabled="true" visible="true" accessible="false" x="0" y="0" width="402" height="874" index="0" traits="">
        <XCUIElementTypeOther type="XCUIElementTypeOther" enabled="true" visible="true" accessible="false" x="0" y="0" width="402" height="212" index="0" traits="">
          <XCUIElementTypeOther type="XCUIElementTypeOther" enabled="true" visible="true" accessible="false" x="0" y="0" width="402" height="236" index="0" traits=""/>
          <XCUIElementTypeStaticText type="XCUIElementTypeStaticText" value="Signals" name="Signals" label="Signals" enabled="true" visible="true" accessible="false" x="18" y="78" width="155" height="58" index="1" traits="StaticText">
            <XCUIElementTypeStaticText type="XCUIElementTypeStaticText" value="Signals" name="Signals" label="Signals" enabled="true" visible="true" accessible="true" x="18" y="78" width="155" height="58" index="0" traits="StaticText"/>
          </XCUIElementTypeStaticText>
          <XCUIElementTypeOther type="XCUIElementTypeOther" name="Événements" label="Événements" enabled="true" visible="true" accessible="true" x="20" y="159" width="116" height="37" index="2" traits="Selected"/>
          <XCUIElementTypeOther type="XCUIElementTypeOther" name="Articles" label="Articles" enabled="true" visible="true" accessible="true" x="143" y="159" width="86" height="37" index="3" traits=""/>
          <XCUIElementTypeOther type="XCUIElementTypeOther" enabled="true" visible="true" accessible="false" x="344" y="159" width="109" height="37" index="5" traits="">
            <XCUIElementTypeButton type="XCUIElementTypeButton" enabled="true" visible="true" accessible="false" x="344" y="159" width="110" height="37" index="0" traits="Button">
              <XCUIElementTypeStaticText type="XCUIElementTypeStaticText" enabled="true" visible="false" accessible="false" x="344" y="159" width="1" height="1" index="0" traits="StaticText"/>
            </XCUIElementTypeButton>
          </XCUIElementTypeOther>
        </XCUIElementTypeOther>
        <XCUIElementTypeScrollView type="XCUIElementTypeScrollView" enabled="true" visible="true" accessible="false" x="0" y="0" width="402" height="874" index="0" traits="">
          <XCUIElementTypeOther type="XCUIElementTypeOther" enabled="true" visible="true" accessible="false" x="0" y="0" width="402" height="3275" index="0" traits="">
            <XCUIElementTypeButton type="XCUIElementTypeButton" name="Conflit militaire États-Unis Iran 2026" label="Conflit militaire États-Unis Iran 2026" enabled="true" visible="true" accessible="true" x="20" y="211" width="362" height="60" index="0" traits="Button"/>
            <XCUIElementTypeOther type="XCUIElementTypeOther" enabled="true" visible="true" accessible="false" x="20" y="271" width="362" height="1" index="1" traits=""/>
            <XCUIElementTypeButton type="XCUIElementTypeButton" name="Guerre d'Ukraine" label="Guerre d'Ukraine" enabled="true" visible="true" accessible="true" x="20" y="392" width="362" height="60" index="6" traits="Button"/>
            <XCUIElementTypeButton type="XCUIElementTypeButton" name="Enquête Fauci COVID-19" label="Enquête Fauci COVID-19" enabled="true" visible="true" accessible="true" x="20" y="573" width="362" height="60" index="12" traits="Button"/>
            <XCUIElementTypeButton type="XCUIElementTypeButton" name="Cyberattaque sur systèmes d'eau Minnesota" label="Cyberattaque sur systèmes d'eau Minnesota" enabled="true" visible="false" accessible="true" x="20" y="935" width="362" height="60" index="24" traits="Button"/>
          </XCUIElementTypeOther>
        </XCUIElementTypeScrollView>
      </XCUIElementTypeOther>
    </XCUIElementTypeWindow>
  </XCUIElementTypeApplication>
</AppiumAUT>`;

/** A minimal source exercising entity decoding and a `name` ≠ `label` identifier. */
export const FORM_SCREEN_SOURCE = `<?xml version="1.0" encoding="UTF-8"?>
<AppiumAUT>
  <XCUIElementTypeApplication type="XCUIElementTypeApplication" name="SigNews" label="SigNews" enabled="true" visible="true" x="0" y="0" width="402" height="874" index="0">
    <XCUIElementTypeOther type="XCUIElementTypeOther" enabled="true" visible="true" x="0" y="0" width="402" height="874" index="0">
      <XCUIElementTypeTextField type="XCUIElementTypeTextField" value="a@b.test" name="email-field" label="Email &amp; login" enabled="true" visible="true" x="20" y="100" width="362" height="44" index="0"/>
      <XCUIElementTypeButton type="XCUIElementTypeButton" name="submit" label="S&#39;abonner" enabled="true" visible="true" x="20" y="160" width="362" height="44" index="1"/>
    </XCUIElementTypeOther>
  </XCUIElementTypeApplication>
</AppiumAUT>`;

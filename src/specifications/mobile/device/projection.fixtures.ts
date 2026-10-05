/** A condensed real XCUITest page source (an Expo app), keeping every noise pattern the projection collapses. */
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
            <XCUIElementTypeButton type="XCUIElementTypeButton" name="Jazz night at the harbour" label="Jazz night at the harbour" enabled="true" visible="true" accessible="true" x="20" y="573" width="362" height="60" index="12" traits="Button"/>
            <XCUIElementTypeButton type="XCUIElementTypeButton" name="Cyberattaque sur systèmes d'eau Minnesota" label="Cyberattaque sur systèmes d'eau Minnesota" enabled="true" visible="false" accessible="true" x="20" y="935" width="362" height="60" index="24" traits="Button"/>
          </XCUIElementTypeOther>
        </XCUIElementTypeScrollView>
      </XCUIElementTypeOther>
    </XCUIElementTypeWindow>
  </XCUIElementTypeApplication>
</AppiumAUT>`;

export const FORM_SCREEN_SOURCE = `<?xml version="1.0" encoding="UTF-8"?>
<AppiumAUT>
  <XCUIElementTypeApplication type="XCUIElementTypeApplication" name="SigNews" label="SigNews" enabled="true" visible="true" x="0" y="0" width="402" height="874" index="0">
    <XCUIElementTypeOther type="XCUIElementTypeOther" enabled="true" visible="true" x="0" y="0" width="402" height="874" index="0">
      <XCUIElementTypeTextField type="XCUIElementTypeTextField" value="a@b.test" name="email-field" label="Email &amp; login" enabled="true" visible="true" x="20" y="100" width="362" height="44" index="0"/>
      <XCUIElementTypeButton type="XCUIElementTypeButton" name="submit" label="S&#39;abonner" enabled="true" visible="true" x="20" y="160" width="362" height="44" index="1"/>
    </XCUIElementTypeOther>
  </XCUIElementTypeApplication>
</AppiumAUT>`;

export const NESTED_SCREEN_SOURCE = `<XCUIElementTypeApplication label="App" visible="true">
  <XCUIElementTypeApplication label="App"/>
  <XCUIElementTypeOther label="" value="" name="" visible="true">
    <XCUIElementTypeCell name="row-1">
      <XCUIElementTypeStaticText label="Row &#x41;&#66;" visible="true"/>
      <XCUIElementTypeCell name="row-1"><XCUIElementTypeOther label="x"/></XCUIElementTypeCell>
      <XCUIElementTypeCell name="row-1"/>
    </XCUIElementTypeCell>
  </XCUIElementTypeOther>
  <XCUIElementTypeSlider value="50%">
    <XCUIElementTypeSlider value="50%"/>
    <XCUIElementTypeOther value="50%"/>
    <XCUIElementTypeSlider value="60%"/>
    <XCUIElementTypeSlider value="50%" name="thumb"/>
    <XCUIElementTypeSlider value="50%" label="Volume"/>
  </XCUIElementTypeSlider>
</XCUIElementTypeApplication>`;

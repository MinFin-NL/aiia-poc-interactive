# Toepasselijkheid van formulieren: wanneer geldt een formulier niet?

**Status: open ontwerpvraag, nog niets gebouwd.** Dit document legt de vraag, de analyse en de
opties vast zodat er later een besluit over genomen kan worden. De aanleiding is de
toegankelijkheidsverklaring, maar de vraag is algemener.

## 1. De aanleiding

Op dit moment tonen alle dossiers alle formulieren. Dat klopt zolang elk formulier voor
vrijwel elk IV-verzoek relevant is, maar dat houdt op bij de
**toegankelijkheidsverklaring** (`toegankelijkheid.json`, spoor `ingebruikname`): een
koppelvlak, een datapipeline of een stuk backoffice-software zonder gebruikersinterface valt
er domweg niet onder. Een formulier dat zichtbaar leeg blijft omdat het niet van toepassing
is, is niet te onderscheiden van een formulier dat vergeten is — en dat is precies het
verschil dat een dossier zou moeten vastleggen.

## 2. Het juridische criterium is níet "publiek toegankelijk"

De intuïtieve regel — "alleen bij publieke websites" — is te smal. Het **Tijdelijk besluit
digitale toegankelijkheid overheid** (uitvoering van Richtlijn (EU) 2016/2102) geldt voor
*websites en mobiele applicaties van overheidsinstanties*, en dat omvat **intranet en
extranet**. Een besloten webapplicatie achter een login valt eronder: een medewerker met een
schermlezer heeft dezelfde aanspraak als een burger. De overgangsuitzondering voor
intranet/extranet zag alleen op content die vóór 23 september 2019 was gepubliceerd, tot aan
een ingrijpende herziening — voor alles wat nu gebouwd wordt is die uitzondering dus dood.

Het onderscheidende criterium is **wel of geen (web)gebruikersinterface**, niet publiek of
intern. Publiek versus intern bepaalt alleen *waar* de verklaring wordt gepubliceerd
(centraal register versus het intranet zelf) en hoe zwaar remediatie weegt — niet óf het
formulier van toepassing is.

Buiten bereik vallen in de praktijk:

- backoffice- of desktopsoftware die niet via de browser wordt aangeboden
- API's en koppelvlakken, batch- en dataverwerking zonder eigen interface
- een model of dataset zonder eigen interface
- infrastructuur- en hardwaretrajecten

Daarnaast kent het besluit inhoudelijke uitzonderingen (archieven, kaarten, content van
derden) — die zitten al ín het formulier bij `tv_a.uitzonderingen` en zijn een andere laag
dan de vraag hier.

Twee dingen die makkelijk misgaan bij het formuleren van een triggervraag:

1. **Inkoop telt mee.** De verplichting rust op de instantie die de voorziening *publiceert of
   aanbiedt*, ook bij ingekochte SaaS. Een leveranciersverklaring (VPAT) ontslaat MinFin niet
   van de plicht zelf een verklaring te publiceren. De vraag moet dus gaan over "levert dit
   project een voorziening op die MinFin aanbiedt", niet over "bouwen we zelf iets".
2. **Verifieer vóór gebruikersgerichte tekst.** Conform de waarschuwing in
   [`sporen-en-roadmap.md`](sporen-en-roadmap.md) §4.2: bovenstaande verwijzingen zijn de
   aanleiding, niet de inhoud. Toets ze tegen de actuele tekst van het besluit en
   digitoegankelijk.nl voordat er iets van in een formulier belandt.

## 3. Opties

### Optie A — gate-sectie ín het formulier

Een `Deel 0: Van toepassing?` bovenaan `toegankelijkheid.json`: één radio plus een verplichte
motivatie bij "nee".

- **Voor:** geen enkele codewijziging; werkt ook als het dossier geen intake heeft; legt de
  negatieve beslissing mét reden vast ("niet van toepassing, want koppelvlak zonder
  gebruikersinterface") — dat is zelf een auditwaardig product.
- **Tegen:** per formulier opnieuw uitgevonden; het formulier blijft in de lijst staan alsof
  het openstaat, dus het lost het "leeg of vergeten"-probleem in het overzicht niet op.

### Optie B — één scopevraag in de intake

Een herbruikbare vraag (bijv. `intake_b.opleverproduct`, type `checkbox`): *"Wat levert dit
project op?"* met opties als publieke website · besloten webapplicatie (login) · mobiele app ·
intranet/extranet · backoffice-software zonder webinterface · API of koppelvlak ·
dataproduct/model zonder eigen interface · infrastructuur/hardware.

De eerste vier ⇒ toegankelijkheid van toepassing.

- **Voor:** één vraag die meer dan één formulier kan gaten; sluit aan op het bestaande
  `crossFormMappings`-idee dat antwoorden hergebruikt worden.
- **Tegen:** doet op zichzelf nog niets zichtbaars — heeft optie C nodig om effect te hebben,
  of blijft een signaal dat alleen de invuller zelf leest.

### Optie C — `applicability` in `index.json` + drie buckets in het overzicht

Een veld per formulier in `public/forms/index.json`, bijvoorbeeld:

```jsonc
"applicability": {
  "sourceFormId": "intake",
  "sourceQuestionId": "intake_b.opleverproduct",
  "appliesWhenAnyOf": ["Publieke website", "Besloten webapplicatie (login)",
                       "Mobiele app", "Intranet/extranet"]
}
```

`DossierDetail.vue` groepeert de kaarten dan in *verplicht* / *mogelijk relevant* / *niet van
toepassing* (ingeklapt, met reden), naast de bestaande spoorindeling.

- **Voor:** het juiste eindplaatje; maakt "niet van toepassing" een expliciete, zichtbare
  toestand in plaats van een leeg formulier.
- **Tegen:** echt codewerk (`FormIndexEntry` in `formLoader.ts`, `trackGroups` en de
  kaartweergave in `DossierDetail.vue`, plus een fallback voor dossiers zonder ingevulde
  intake). Een engine bouwen voor één regel.

## 4. Voorlopige aanbeveling

**A + B nu, C zodra er een derde formulier is dat het nodig heeft.** Toegankelijkheid is het
eerste formulier met een echte toepasselijkheidsvraag; `algoritmeregister` en
`verwerkingsregister` zijn de waarschijnlijke volgende kandidaten. Zolang het bij één regel
blijft, is de gate-sectie goedkoper en robuuster dan een generieke motor — en optie B kost
één intakevraag die later ongewijzigd de input van optie C is.

Openstaande punten voor het besluit:

- Moet "niet van toepassing" het formulier verbergen, of doorstrepen mét zichtbare motivatie?
  (Voorkeur: het tweede — verbergen maakt de beslissing onvindbaar.)
- Wat gebeurt er bij een dossier zonder ingevulde intake — alles tonen, of alles als
  "mogelijk relevant"?
- Wordt de toepasselijkheidsbeslissing meegenomen in de PDF-export van het dossier?

## 5. Raakvlakken

- [`sporen-en-roadmap.md`](sporen-en-roadmap.md) §5 — waar `track`/`domains`/`index.json` in
  de code zitten; optie C haakt daar direct op aan.
- [`beslishulp-integration-design.md`](beslishulp-integration-design.md) — de beslisboom van
  de AI-verordening doet iets verwants (bepalen wat er geldt), maar op verplichtingenniveau
  binnen één formulier, niet op formulierniveau. Bij optie C is het de moeite waard te kijken
  of de twee patronen elkaar moeten kennen.

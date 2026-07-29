# Sporen: de indeling, en de roadmap van wat er nog ontbreekt

> **Status:** de indeling is doorgevoerd (juli 2026). De roadmap in §4 is een voorstel —
> geen commitment.

Dit document legt vast *waarom* de formulieren zijn ingedeeld zoals ze zijn ingedeeld, zodat
de volgende persoon die een formulier toevoegt niet opnieuw hoeft te gokken. Het vervangt de
vorige indeling (Project / Compliance / Assessments / AI-governance).

## 1. Wat er mis was met de vorige indeling

De vier oude sporen waren vier *verschillende classificatie-assen* door elkaar:

| Oud spoor | Impliciete as | Vraag die het beantwoordde |
|---|---|---|
| Projectspoor | levensfase | wanneer in het traject? |
| Compliancespoor | juridische drijfveer | waarom moet ik dit? |
| Assessments | instrumenttype | wat voor document is dit? |
| AI-governance | onderwerpsdomein | waar gaat het over? |

Elk formulier scoort tegelijk op alle vier de assen, dus de categorieën konden per definitie
niet wederzijds uitsluitend zijn. Dat is de klassieke fout uit de informatie-architectuur: een
*facet* platslaan tot een *hiërarchie*. Het symptoom is altijd hetzelfde — overlap, wezen, en
auteurs die niet kunnen kiezen.

De symptomen waren allemaal aanwezig:

- **De DPIA is wettelijk verplicht (AVG art. 35) maar stond niet in Compliance.** De *EU AI
  Act Compliance Checklist* had "compliance" in de eigen titel en stond in Assessments.
  "Compliance" betekende dus niets consistents.
- **Quick scan BIO en Prescan DPIA zijn hetzelfde instrumenttype** — een triage die bepaalt of
  een zwaarder instrument nodig is — en stonden in verschillende sporen.
- **Het Compliancespoor had n=1.** Een categorie van één is geen categorie.
- **De cross-form-graaf sprak de sporen tegen.** Bijna elke van de 87 mappings in
  `crossFormMappings.json` kruiste een spoorgrens: `quickscan`→`prescandpia`,
  `aiia`→`modelcard`, `psa`→ vier formulieren in twee andere sporen. Als de sporen de
  werkelijke werkvolgorde beschreven, zouden de meeste kanten *binnen* een spoor lopen.
- **De eigen brainstormdocumenten konden niet classificeren.** In
  `AI-BOK-form-opportunities.md` en `DAMA-DMBOK-form-opportunities.md` kregen negen
  voorgestelde formulieren negen keer een slash of een "of": "`assessment` (of nieuwe track
  `eu-ai-act`)", "nieuw `data` of bestaand `compliance`", "`governance`/`data`". Een taxonomie
  die de eigen auteur niet kan bedienen, bedient de gebruiker ook niet.

## 2. De regel: één as, de rest wordt facet

**`track` = de levensfase.** Dat is de enige groeperingsas. Het is de as die de pijlen in de
UI al suggereerden, die de cross-form-graaf feitelijk volgt, en die de vraag beantwoordt die
de gebruiker heeft op het moment dat hij een dossier opent: *waar ben ik?*

**`domains` = het onderwerpsdomein**, als tag op de kaart: `privacy` · `beveiliging` · `ai` ·
`data` · `project`. Een formulier mag er meerdere hebben. Dit is bewust géén kop, want het is
een facet — het antwoordt op *wat raakt dit?*, een andere vraag.

> **Voeg nooit een spoor toe om een domein uit te drukken.** Een datakwaliteitsformulier is
> `track: "ontwerpen"` + `domains: ["data"]`, niet `track: "data"`. Precies die verwarring is
> hierboven opgeruimd.

## 3. De indeling

| Spoor (`track`) | Formulieren nu |
|---|---|
| `verkennen` — Verkennen & afbakenen | intake, quickscan (BIO), prescandpia |
| `besluiten` — Onderbouwen & besluiten | aanbiedingsformulier |
| `ontwerpen` — Ontwerpen | ppm, psa |
| `toetsen` — Toetsen | dpia, aiia, iama, euaiact |
| `ingebruikname` — In gebruik nemen | modelcard |
| `beheer` — Beheren & evalueren | *(leeg, bewust zichtbaar)* |

`beheer` is leeg en wordt tóch getoond, met een `emptyHint` in `TRACK_META`. Het gat
zichtbaar maken is een doel van deze indeling, geen bijvangst: zolang de as klopt, is een leeg
spoor eerlijker dan een indeling die doet alsof er niets ontbreekt.

### Waarom de organisatiebrede formulieren zijn verwijderd

Drie formulieren zijn bij deze herindeling **verwijderd**: `governancecharter` (AI Governance
Charter), `maturityscan` (AI Maturity Quick Scan) en `shadowai` (Shadow AI Inventarisatie).
Ze staan in de git-historie en zijn daaruit terug te halen.

De reden is de eenheid van analyse. Alle formulieren in de tool beschrijven een *object*, en
dat object moet passen bij het dossier dat ze bevat:

| Formulier | Eenheid van analyse |
|---|---|
| intake, aanbiedingsformulier, ppm, psa | **project** |
| prescandpia, dpia | **verwerking** |
| aiia, iama, euaiact, modelcard | **AI-systeem** |
| quickscan | **informatiesysteem** |
| ~~governancecharter~~ | ~~organisatie~~ |
| ~~maturityscan~~ | ~~organisatie / afdeling~~ |
| ~~shadowai~~ | ~~afdeling~~ |

`Dossier` (`src/stores/assessmentStore.ts`) = één project, met `forms: Record<FormId,
FormState>` — één exemplaar van *elk* formulier. Je vult één governance charter in voor je
ministerie, niet één per project; de tool nodigde uit om dat veertig keer te doen. Dat de
drie **nul cross-form-mappings** hadden, in noch uit, was daar het meetbare symptoom van: ze
deelden niets met de rest omdat ze ergens anders over gingen.

Een eigen spoor eronder loste dat niet op — het gaf de mismatch alleen een nettere naam. Een
echte oplossing is een organisatieniveau *naast* de dossiers, met een eigen levensduur en
eigen rechten, wat `Dossier`-state, persistence, sharing en collab raakt. Tot dat er is, is
niets tonen eerlijker dan iets tonen dat structureel verkeerd staat.

**Consequentie voor nieuwe formulieren:** een instrument dat over de organisatie of een
afdeling gaat hoort niet in een dossier, en dus (voorlopig) niet in deze tool. Dat raakt ook
twee voorstellen in [`DAMA-DMBOK-form-opportunities.md`](DAMA-DMBOK-form-opportunities.md):
de data-management volwassenheidsscan (§4B) en het Data Governance Charter (§4D) zijn om
dezelfde reden geparkeerd.

De frictie project ↔ verwerking ↔ systeem is subtieler maar even echt: één project levert
drie systemen en vijf verwerkingen op, en dat is nu niet uitdrukbaar.

## 4. Roadmap: wat er ontbreekt

### 4.1 Het structurele gat: alles ná het besluit

Elk instrument in de tool is *ex ante*. In PDCA-termen: alleen Plan, niets voor Check en Act.
Dat is niet alleen theoretisch onbevredigend — het is precies waar de wetgeving doorlopende
verplichtingen legt, o.a. AI Act art. 26 (menselijk toezicht), art. 72 (post-market
monitoring), art. 73 (melden ernstige incidenten) en art. 12 (logging); AVG art. 35 lid 11
(herbeoordeling bij gewijzigd risico) en art. 33 (meldplicht datalek); en de Archiefwet voor
bewaren en vernietigen. Vandaar dat `beheer` als leeg spoor zichtbaar is.

### 4.2 Voorgestelde formulieren, geprioriteerd

Volgorde op (waarde × wettelijke hardheid) ÷ bouwkosten. Nrs. 1–4 zijn JSON-only en vormen
samen de sterkste sprong.

| # | Formulier | Spoor | Grondslag / bron | Waarom |
|---|---|---|---|---|
| 1 | **Verwerkingsregister** | `ingebruikname` | AVG art. 30 | Breder verplicht dan een DPIA en nu volledig afwezig. Sterk tabelgedreven → past op de bestaande table-questions. Vult zich grotendeels uit dpia + intake via `crossFormMappings`. |
| 2 | **Restrisico-acceptatie / besluitformulier** | `besluiten` | sluitstuk van DPIA/AIIA/BIO | Klein formulier, groot effect. In elk risicoraamwerk is acceptatie door de verantwoordelijke eigenaar de sluitsteen; zonder handtekening bungelen alle assessments. Trekt restrisico's uit dpia/aiia/quickscan. |
| 3 | **Toegankelijkheidsverklaring** | `ingebruikname` | Tijdelijk besluit digitale toegankelijkheid overheid; EN 301 549 / WCAG 2.1 AA | Wettelijk verplicht voor overheidsdiensten en nergens gedekt. **Er bestaat een officieel model** (DigiToegankelijk) — harmoniseren zoals bij `par-dpia-form`, niet zelf verzinnen. |
| 4 | **Algoritmeregister-publicatie** | `ingebruikname` | Standaard van het Algoritmeregister | Vast veldenschema upstream → zelfde harmonisatie-aanpak. Sluit direct aan op de Model Card; veel velden zijn afleidbaar. |
| 5 | **Inkoop- & leverancierstoets AI** | `ontwerpen` | ARBIT/GIBIT; EU-modelcontractbepalingen AI-inkoop (PIANOo); NeRDS "open, tenzij" | De overheid bouwt zelden zelf. Voor ingekochte AI is dit het dominante risico-oppervlak en er is geen instrument voor. Geen kant-en-klaar NL-invulinstrument → afleiden. Neem exit-strategie / vendor lock-in expliciet op. |
| 6 | **Verwerkersovereenkomst-checklist** | `ontwerpen` | AVG art. 28 | Geen contract, wél een checklist of alle verplichte elementen erin staan. Klein en concreet. |
| 7 | **Periodieke herijking** | `beheer` | AVG art. 35 lid 11; AI Act art. 72 | Vraagt een nieuw patroon — "wat is er veranderd sinds de vorige DPIA/AIIA" verwijst terug naar eerdere antwoorden. **Mogelijk codewerk** (versievergelijking). |
| 8 | **Incidentregistratie & melding** | `beheer` | AVG art. 33/34; AI Act art. 73 | Tabelgedreven, JSON-only, met een beslisboom voor de meldplicht (past op het bestaande decision-gate-patroon). |
| 9 | **Datakwaliteit + dataset-registratie** | `ontwerpen` | DAMA-DMBOK; ISO/IEC 25012; DCAT-AP-NL, MIM 1.2 | Al uitgewerkt in [`DAMA-DMBOK-form-opportunities.md`](DAMA-DMBOK-form-opportunities.md) §4A en §4C — dat document is de spec. DPIA, AIIA en Model Card leunen allemaal op de datalaag die nu nergens wordt vastgelegd. |
| 10 | **Uitfaseringsplan** | `beheer` | Archiefwet; AVG art. 5 lid 1 sub e | Sluit de levenscyclus. Laagste urgentie, maar zonder dit blijft `beheer` half. |

> **Bij het bouwen:** de artikelverwijzingen hierboven zijn de *aanleiding*, niet de inhoud.
> Verifieer elke grondslag tegen de actuele wettekst voordat er gebruikersgerichte tekst in een
> formulier komt — mensen steunen op wat de tool zegt.

### 4.3 Bewust niet op de lijst

- **Een volledig BIO2-/ENSIA-instrument.** BIO2/ISO 27001 vraagt risicoanalyse,
  maatregelenmatrix en in-controlverklaring, met een eigen keten en een auditor. Dat is een
  eigen product en past slecht in de dossier-vorm. Beter ernaar verwijzen dan half nabouwen.
  (De huidige quickscan blijft wat hij is: een BBN-bepaling, niet meer.)

### 4.4 Losse inhoudelijke observatie

44 van de 87 cross-form-mappings lopen tussen DPIA en AIIA (23 heen, 21 terug). Dat is een
sterk signaal van inhoudelijke duplicatie. De vraag of AIIA en IAMA allebei als volledig
formulier moeten bestaan — of dat één ervan een module binnen de ander wordt — is het
overwegen waard, maar staat los van de indeling.

## 5. Waar het in de code zit

- `public/forms/index.json` — `track`, `order`, `domains` per formulier
- `src/components/DossierDetail.vue` — `TRACK_META` (labels, beschrijvingen, volgorde,
  `emptyHint`), `trackGroups`, `connectorGlyph`, `DOMAIN_LABELS`
- `src/services/formLoader.ts` — `FormIndexEntry`, `FormDomain`
- `.claude/skills/forms/SKILL.md` — de dev-contract voor het toevoegen van een formulier

Een onbekende `track` in `index.json` belandt in een zichtbaar `onbekend`-spoor en logt een
`console.warn` — vroeger viel zo'n typo stil in de assessments-groep.

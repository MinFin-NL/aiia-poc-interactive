<template>
  <div class="rvo-max-width-layout rvo-max-width-layout--md rvo-max-width-layout-inline-padding--sm" style="padding-top: 48px; padding-bottom: 48px;">
    <div class="rvo-layout-column rvo-layout-gap--xl">

      <div>
        <h1 class="rvo-heading rvo-heading--2xl" style="color: #154273; margin-bottom: 8px;">
          Data Protection Impact Assessment
        </h1>
        <p class="rvo-text rvo-text--lg" style="color: #555; margin: 0;">
          Versie 1.0 — Ministerie van Financiën
        </p>
      </div>

      <div class="rvo-alert rvo-alert--info" style="border-radius: 4px;">
        <div class="rvo-alert__content">
          <strong>Let op:</strong> Dit is een digitale hulptool bij het uitvoeren van een Data Protection Impact Assessment (DPIA).
          Het invullen van dit formulier vervangt niet het advies van juridische of privacy-experts.
          Raadpleeg bij twijfel altijd de Functionaris voor de Gegevensbescherming (FG) of een privacy-jurist.
        </div>
      </div>

      <div class="rvo-layout-column rvo-layout-gap--md">
        <h2 class="rvo-heading rvo-heading--xl" style="color: #154273;">Over dit instrument</h2>
        <p class="rvo-text">
          Een DPIA (ook wel gegevensbeschermingseffectbeoordeling) is verplicht bij verwerkingen die
          waarschijnlijk een hoog risico opleveren voor de rechten en vrijheden van betrokkenen.
          Dit instrument begeleidt u stap voor stap door het proces zoals voorgeschreven door de AVG (artikel 35).
        </p>
        <p class="rvo-text">Een DPIA omvat minimaal:</p>
        <ul class="rvo-ul">
          <li>Een <strong>beschrijving</strong> van de verwerking en de verwerkingsdoeleinden</li>
          <li>Een <strong>noodzakelijkheids- en proportionaliteitsbeoordeling</strong></li>
          <li>Een <strong>risicobeoordeling</strong> voor de rechten en vrijheden van betrokkenen</li>
          <li><strong>Maatregelen</strong> om de risico's te beheersen</li>
        </ul>
        <p class="rvo-text">
          Na afronding kunt u de DPIA exporteren als PDF-document voor archivering en consultatie met de FG.
        </p>
      </div>

      <div class="rvo-layout-column rvo-layout-gap--sm">
        <h2 class="rvo-heading rvo-heading--xl" style="color: #154273;">Kleurcodering vragen</h2>
        <div class="rvo-layout-row rvo-layout-gap--md" style="flex-wrap: wrap;">
          <div class="rvo-layout-row rvo-layout-gap--sm" style="align-items: center;">
            <div style="width: 16px; height: 16px; background: #0070bb; border-radius: 2px; flex-shrink: 0;"></div>
            <span class="rvo-text"><strong>Blauw – verplicht:</strong> moet altijd worden ingevuld</span>
          </div>
          <div class="rvo-layout-row rvo-layout-gap--sm" style="align-items: center;">
            <div style="width: 16px; height: 16px; background: #39870c; border-radius: 2px; flex-shrink: 0;"></div>
            <span class="rvo-text"><strong>Groen – aanvullend:</strong> invullen indien van toepassing</span>
          </div>
        </div>
      </div>

      <div>
        <button @click="$emit('start')" class="rvo-button rvo-button--primary" style="font-size: 1.1rem; padding: 12px 32px;">
          Starten met de DPIA
        </button>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
defineEmits<{ start: [] }>()
</script>

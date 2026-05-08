import { useState } from 'react';
import { useMapPins } from '../../hooks/useMapPins';
import { MapLayerControl } from './MapLayerControl';
import { MapCanvas } from './MapCanvas';
import { MapInfoPane } from './MapInfoPane';
import styles from './interactive-map.module.css';

const DEFAULT_LAYERS = {
  incidents: true,
  panic: true,
  cctv: true,
  houses: true,
  roads: true,
};

export function InteractiveMapView() {
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [selectedPin, setSelectedPin] = useState(null);

  const { incidentPins, panicPins, cameraPins } = useMapPins();
  const allPins = [...incidentPins, ...panicPins, ...cameraPins];

  function toggleLayer(key) {
    setLayers((l) => ({ ...l, [key]: !l[key] }));
  }

  return (
    <div className={styles.view}>
      <MapLayerControl
        layers={layers}
        onToggle={toggleLayer}
        counts={{
          incidents: incidentPins.length,
          panic: panicPins.length,
          cctv: cameraPins.length,
        }}
      />
      <MapCanvas
        pins={allPins}
        layers={layers}
        selectedPinId={selectedPin?.id}
        onPinClick={setSelectedPin}
      />
      <MapInfoPane pin={selectedPin} />
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { IconLayer } from "@deck.gl/layers";
import DeckGL from "@deck.gl/react";
import { Color } from "@deck.gl/core";
import { Progress, Card } from "@nextui-org/react";
import { useTheme } from "next-themes";
import Map from "react-map-gl/mapbox"; // ✅ Using correct Map import

// Helper function: Convert snake_case to Title Case
const snakeToTitle = (str: string): string => {
  return str
    .replace(/_/g, " ") // Replace underscores with spaces
    .replace(/\b\w/g, (char) => char.toUpperCase()); // Capitalize first letter
};

// ** Mock Data for Testing (Ensures All Points Are Shown) **
const testData = [
  {
    id: "latitudes",
    values: [37.7749, 37.774, 37.7735, 37.772, 37.77, 37.768],
  },
  {
    id: "longitudes",
    values: [-122.4194, -122.419, -122.4185, -122.418, -122.4175, -122.417],
  },
  {
    id: "names",
    values: [
      "San Francisco",
      "Point 1",
      "Point 2",
      "Point 3",
      "Point 4",
      "Point 5",
    ],
  },
  {
    id: "statuses",
    values: [
      "healthy",
      "healthy",
      "healthy",
      "predicted failure",
      "predicted failure",
      "down for repairs",
    ],
  },
];

const useMapTheme = () => {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "dark"
    ? "mapbox://styles/mapbox/dark-v11"
    : "mapbox://styles/mapbox/streets-v11";
};

const MapChart = () => {
  const [isLoading] = useState<boolean>(false);
  const mapTheme = useMapTheme();

  // Process the data to match Deck.gl's format
  const rawData = testData[0].values.map((lat, index) => ({
    location: { latitude: lat, longitude: testData[1].values[index] },
    name: testData[2].values[index],
    metadata: { status: testData[3].values[index] },
  }));

  const [hoverInfo, setHoverInfo] = useState<{
    object?: any;
    x: number;
    y: number;
  }>();

  const getMarkerColor = (status: string) => {
    switch (status) {
      case "healthy":
        return [0, 192, 0]; // Green
      case "predicted failure":
        return [255, 255, 128]; // Yellow
      case "down for repairs":
        return [235, 52, 52]; // Red
      default:
        return [40, 171, 160]; // Default teal
    }
  };

  const layers = [
    new IconLayer({
      id: "icon-layer",
      data: rawData,
      pickable: true,
      iconAtlas: "/dot.png",
      iconMapping: {
        marker: { x: 0, y: 0, width: 128, height: 128, mask: true },
      },
      getIcon: () => "marker",
      sizeScale: 15,
      getPosition: (d) => [d.location.longitude, d.location.latitude],
      getSize: () => 5, // ✅ All markers are now correctly sized
      getColor: (d) => getMarkerColor(d.metadata.status),
      onHover: (info) => setHoverInfo(info),
    }),
  ];

  return (
    <DeckGL
      initialViewState={{
        longitude: -122.4194,
        latitude: 37.7749,
        zoom: 13,
        pitch: 0,
        bearing: 0,
      }}
      controller={true}
      layers={layers}
    >
      {isLoading && (
        <Progress size="sm" isIndeterminate aria-label="Loading..." />
      )}

      <Map
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_PUBKEY}
        mapStyle={mapTheme}
      />

      {hoverInfo?.object && (
        <div
          style={{
            position: "absolute",
            left: hoverInfo.x,
            top: hoverInfo.y,
            pointerEvents: "none",
          }}
        >
          <Card className="shadow-xl p-2 rounded-md gap-1">
            <p className="text-md font-medium">{hoverInfo.object.name}</p>
          </Card>
        </div>
      )}
    </DeckGL>
  );
};

export default MapChart;

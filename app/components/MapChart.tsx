"use client";

import { useState, useMemo } from "react";
import { IconLayer, TextLayer } from "@deck.gl/layers";
import DeckGL from "@deck.gl/react";
import { WebMercatorViewport } from "@deck.gl/core";
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

// ----------------- UNION–FIND HELPER CLASS -----------------
class UnionFind {
  parent: number[];

  constructor(n: number) {
    this.parent = new Array(n);
    for (let i = 0; i < n; i++) {
      this.parent[i] = i;
    }
  }

  find(i: number): number {
    if (this.parent[i] !== i) {
      this.parent[i] = this.find(this.parent[i]);
    }
    return this.parent[i];
  }

  union(i: number, j: number) {
    const rootI = this.find(i);
    const rootJ = this.find(j);
    if (rootI !== rootJ) {
      this.parent[rootJ] = rootI;
    }
  }
}

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

  // Maintain view state so that clustering can update as you zoom/pan.
  const initialViewState = {
    longitude: -122.4194,
    latitude: 37.7749,
    zoom: 13,
    pitch: 0,
    bearing: 0,
  };
  const [viewState, setViewState] = useState(initialViewState);

  // Determine marker color based on status.
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

  // ----------------- CLUSTERING LOGIC -----------------
  const clusters = useMemo(() => {
    // Define a clustering radius in screen pixels (adjust as needed)
    const clusterRadius = 50;

    // Create a viewport for projecting geographic coordinates into screen space.
    const viewport = new WebMercatorViewport({
      ...viewState,
      width: window.innerWidth,
      height: window.innerHeight,
    });

    // Project each rawData point to screen coordinates.
    const projectedPoints = rawData.map((point, index) => {
      const [x, y] = viewport.project([
        point.location.longitude,
        point.location.latitude,
      ]);
      return { ...point, index, screenX: x, screenY: y };
    });

    const n = projectedPoints.length;
    if (n === 0) return [];

    // Initialize union–find structure.
    const uf = new UnionFind(n);

    // For each pair of points, union them if they are within the clusterRadius.
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = projectedPoints[i].screenX - projectedPoints[j].screenX;
        const dy = projectedPoints[i].screenY - projectedPoints[j].screenY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= clusterRadius) {
          uf.union(i, j);
        }
      }
    }

    // Group points by their root parent.
    const groups: { [key: number]: any[] } = {};
    for (let i = 0; i < n; i++) {
      const root = uf.find(i);
      if (!groups[root]) {
        groups[root] = [];
      }
      groups[root].push(projectedPoints[i]);
    }

    // Build an array of clusters.
    const clusteredData = [];
    Object.values(groups).forEach((group) => {
      if (group.length === 1) {
        // A single point; not a cluster.
        clusteredData.push({ ...group[0], isCluster: false });
      } else {
        // Create a cluster with aggregated data.
        const count = group.length;
        const avgLat =
          group.reduce((sum, p) => sum + p.location.latitude, 0) / count;
        const avgLon =
          group.reduce((sum, p) => sum + p.location.longitude, 0) / count;
        // Aggregate statuses to determine the dominant color.
        const statusCounts: { [key: string]: number } = {};
        group.forEach((p) => {
          const status = p.metadata.status;
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
        let dominantStatus = group[0].metadata.status;
        let maxCount = 0;
        Object.keys(statusCounts).forEach((status) => {
          if (statusCounts[status] > maxCount) {
            maxCount = statusCounts[status];
            dominantStatus = status;
          }
        });
        clusteredData.push({
          id: "cluster-" + group.map((p) => p.index).join("-"),
          location: { latitude: avgLat, longitude: avgLon },
          metadata: { status: dominantStatus, count: count },
          isCluster: true,
        });
      }
    });

    return clusteredData;
  }, [rawData, viewState]);

  // ----------------- LAYER SETUP -----------------
  const layers = [
    new IconLayer({
      id: "icon-layer",
      data: clusters,
      pickable: true,
      iconAtlas: "/dot.png",
      iconMapping: {
        marker: { x: 0, y: 0, width: 128, height: 128, mask: true },
      },
      getIcon: () => "marker",
      sizeScale: 15,
      getPosition: (d: any) => [d.location.longitude, d.location.latitude],
      // Use a larger marker size for clusters (here we use logarithmic scaling)
      getSize: (d: any) =>
        d.isCluster ? Math.max(10, Math.log2(d.metadata.count) * 10) : 5,
      getColor: (d: any) => getMarkerColor(d.metadata.status),
      onHover: (info) => setHoverInfo(info),
    }),
    // Optionally, add a TextLayer to display cluster counts.
    new TextLayer({
      id: "text-layer",
      data: clusters.filter((d: any) => d.isCluster && d.metadata.count > 1),
      getPosition: (d: any) => [d.location.longitude, d.location.latitude],
      getText: (d: any) => `${d.metadata.count}`,
      getSize: 16,
      getColor: [255, 255, 255],
      getTextAnchor: "middle",
      getAlignmentBaseline: "center",
    }),
  ];

  return (
    <DeckGL
      viewState={viewState}
      onViewStateChange={({ viewState }) => setViewState(viewState)}
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
            <p className="text-md font-medium">
              {hoverInfo.object.isCluster
                ? `Cluster of ${hoverInfo.object.metadata.count}`
                : hoverInfo.object.name}
            </p>
          </Card>
        </div>
      )}
    </DeckGL>
  );
};

export default MapChart;

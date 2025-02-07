"use client";

import { useState, useMemo } from "react";
import { IconLayer } from "@deck.gl/layers";
import DeckGL from "@deck.gl/react";
import { WebMercatorViewport } from "@deck.gl/core";
import { Progress, Card } from "@nextui-org/react";
import { useTheme } from "next-themes";
import Map from "react-map-gl/mapbox"; // ✅ Using correct Map import

// ------------------ HELPER FUNCTIONS ------------------

// Converts snake_case to Title Case (if needed)
const snakeToTitle = (str: string): string =>
  str.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

// Returns a marker color array for use in IconLayer
const getMarkerColor = (status: string): number[] => {
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

// Returns a CSS color string for a given status (used in the donut chart)
const getStatusColorString = (status: string): string => {
  switch (status) {
    case "healthy":
      return "green";
    case "predicted failure":
      return "yellow";
    case "down for repairs":
      return "red";
    default:
      return "teal";
  }
};

// ------------------ CLUSTER DONUT COMPONENT ------------------

// This component renders an SVG donut chart for a cluster.
// It expects a "colorCounts" object (keys are status strings and values are counts)
// and a total number of points.
const ClusterDonut = ({
  colorCounts,
  total,
}: {
  colorCounts: { [key: string]: number };
  total: number;
}) => {
  return (
    <svg width="50" height="50" viewBox="0 0 50 50">
      {Object.entries(colorCounts).reduce((acc, [status, count], i, arr) => {
        const percentage = (count / total) * 100;
        const offset = arr
          .slice(0, i)
          .reduce((sum, [_, c]) => sum + (Number(c) / total) * 100, 0);
        return [
          ...acc,
          <circle
            key={status}
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke={getStatusColorString(status)}
            strokeWidth="10"
            strokeDasharray={`${percentage} ${100 - percentage}`}
            strokeDashoffset={-offset}
          />,
        ];
      }, [] as JSX.Element[])}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dy=".3em"
        fontSize="12"
        fontWeight="bold"
      >
        {total}
      </text>
    </svg>
  );
};

// ------------------ MOCK DATA ------------------

// Sample data with six points.
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

// ------------------ MAP THEME HOOK ------------------
const useMapTheme = () => {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "dark"
    ? "mapbox://styles/mapbox/dark-v11"
    : "mapbox://styles/mapbox/streets-v11";
};

// ------------------ UNION–FIND HELPER CLASS ------------------
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

// ------------------ MAIN COMPONENT ------------------
const MapChart = () => {
  const [isLoading] = useState<boolean>(false);
  const mapTheme = useMapTheme();

  // Process raw data into a more convenient format.
  const rawData = testData[0].values.map((lat, index) => ({
    location: {
      latitude: lat,
      longitude: testData[1].values[index],
    },
    name: testData[2].values[index],
    metadata: { status: testData[3].values[index] },
  }));

  const [hoverInfo, setHoverInfo] = useState<{
    object?: any;
    x: number;
    y: number;
  }>();

  // Maintain view state so that clustering updates on zoom/pan.
  const initialViewState = {
    longitude: -122.4194,
    latitude: 37.7749,
    zoom: 13,
    pitch: 0,
    bearing: 0,
  };
  const [viewState, setViewState] = useState(initialViewState);

  // ------------------ CLUSTERING LOGIC ------------------
  // Using union–find, points within a fixed screen-space radius are grouped.
  const clusters = useMemo(() => {
    const clusterRadius = 50; // in pixels

    // Create a viewport for projecting geographic coordinates.
    const viewport = new WebMercatorViewport({
      ...viewState,
      width: window.innerWidth,
      height: window.innerHeight,
    });

    // Project each rawData point to screen space.
    const projectedPoints = rawData.map((point, index) => {
      const [x, y] = viewport.project([
        point.location.longitude,
        point.location.latitude,
      ]);
      return { ...point, index, screenX: x, screenY: y };
    });

    const n = projectedPoints.length;
    if (n === 0) return [];

    // Initialize union–find.
    const uf = new UnionFind(n);
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

    // Group points by their root.
    const groups: { [key: number]: any[] } = {};
    for (let i = 0; i < n; i++) {
      const root = uf.find(i);
      if (!groups[root]) {
        groups[root] = [];
      }
      groups[root].push(projectedPoints[i]);
    }

    // Build clusters.
    const clusteredData = [];
    Object.values(groups).forEach((group) => {
      if (group.length === 1) {
        // A single point remains as is.
        clusteredData.push({ ...group[0], isCluster: false });
      } else {
        const count = group.length;
        const avgLat =
          group.reduce((sum, p) => sum + p.location.latitude, 0) / count;
        const avgLon =
          group.reduce((sum, p) => sum + p.location.longitude, 0) / count;
        // Aggregate counts for each status.
        const statusCounts: { [key: string]: number } = {};
        group.forEach((p) => {
          const status = p.metadata.status;
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
        // (Optional) Determine dominant status for color selection.
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
          metadata: {
            statusCounts,
            count,
            dominantStatus,
          },
          isCluster: true,
        });
      }
    });

    return clusteredData;
  }, [rawData, viewState]);

  // Separate individual points from clusters.
  const individualPoints = clusters.filter((d) => !d.isCluster);
  const clusterPoints = clusters.filter((d) => d.isCluster);

  // ------------------ LAYER SETUP ------------------
  // Render individual points using an IconLayer.
  const layers = [
    new IconLayer({
      id: "icon-layer",
      data: individualPoints,
      pickable: true,
      iconAtlas: "/dot.png",
      iconMapping: {
        marker: { x: 0, y: 0, width: 128, height: 128, mask: true },
      },
      getIcon: () => "marker",
      sizeScale: 15,
      getPosition: (d: any) => [d.location.longitude, d.location.latitude],
      getSize: () => 5,
      getColor: (d: any) => getMarkerColor(d.metadata.status),
      onHover: (info) => setHoverInfo(info),
    }),
  ];

  // Create a viewport to compute screen coordinates for cluster overlays.
  const viewport = new WebMercatorViewport({
    ...viewState,
    width: window.innerWidth,
    height: window.innerHeight,
  });

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

      {/* Render the donut chart overlay for each cluster */}
      {clusterPoints.map((cluster: any) => {
        // Project geographic coordinates to screen space.
        const [x, y] = viewport.project([
          cluster.location.longitude,
          cluster.location.latitude,
        ]);
        return (
          <div
            key={cluster.id}
            style={{
              position: "absolute",
              left: x - 25, // center the 50px-wide donut
              top: y - 25,
              cursor: "pointer",
            }}
            onClick={() => {
              // Zoom in on cluster click.
              setViewState((prev: any) => ({
                ...prev,
                zoom: Math.min(prev.zoom + 1, 16),
                longitude: cluster.location.longitude,
                latitude: cluster.location.latitude,
              }));
            }}
          >
            <ClusterDonut
              colorCounts={cluster.metadata.statusCounts}
              total={cluster.metadata.count}
            />
          </div>
        );
      })}

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
                ? `Cluster: ${hoverInfo.object.metadata.count}`
                : hoverInfo.object.name}
            </p>
          </Card>
        </div>
      )}
    </DeckGL>
  );
};

export default MapChart;

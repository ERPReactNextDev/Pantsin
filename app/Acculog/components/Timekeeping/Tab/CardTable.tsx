"use client";

import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LuLogs, LuCalendarClock, LuCloudDownload, LuMapPinCheck } from "react-icons/lu";
import LogModal from "../Modal/Log";
import CalendarModal from "../Modal/Calendar";

// Only run Leaflet code on client
const isClient = typeof window !== "undefined";

// FitBounds helper
const FitBounds: React.FC<{ coords: { lat: number; lng: number }[] }> = ({ coords }) => {
  const map = useMap();
  useEffect(() => {
    if (coords.length > 0) {
      const bounds = L.latLngBounds(coords.map((c) => [c.lat, c.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [coords, map]);
  return null;
};

const defaultMarker = isClient
  ? new L.Icon({
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    })
  : undefined;

interface CardTableProps {
  filteredData: [string, any[]][];
  setOpenModal: React.Dispatch<React.SetStateAction<string | null>>;
  openModal: string | null;
  setOpenCalendar: React.Dispatch<React.SetStateAction<string | null>>;
  openCalendar: string | null;
  filterByDate: (logs: any[]) => any[];
  handleExportExcel: (logs: any[], filename: string) => void;
  computeRemarks: (log: any) => string;
  formatDate: (date: string) => string;
  formatDuration: (ms: number) => string;
}

const CardTable: React.FC<CardTableProps> = ({
  filteredData,
  setOpenModal,
  openModal,
  setOpenCalendar,
  openCalendar,
  filterByDate,
  handleExportExcel,
  computeRemarks,
  formatDate,
  formatDuration,
}) => {
  const [openMap, setOpenMap] = useState<string | null>(null);
  const [mapCoords, setMapCoords] = useState<{ lat: number; lng: number; name: string }[]>([]);

  if (!isClient) return null; // Prevent server-side rendering

  return (
    <div className="overflow-x-auto w-full rounded-lg shadow-md border border-gray-200">
      <table className="w-full table-auto border-collapse">
        <thead className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white sticky top-0 z-10 shadow">
          <tr className="text-xs text-left whitespace-nowrap">
            <th className="px-6 py-4 font-semibold">Fullname</th>
            <th className="px-6 py-4 font-semibold">Email</th>
            <th className="px-6 py-4 font-semibold">Department</th>
            <th className="px-6 py-4 font-semibold">Late</th>
            <th className="px-6 py-4 font-semibold">Overtime</th>
            <th className="px-6 py-4 font-semibold">Undertime</th>
            <th className="px-6 py-4 font-semibold">Invalid Time</th>
            <th className="px-6 py-4 font-semibold">Days ( Late )</th>
            <th className="px-6 py-4 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredData.map(([email, logs]) => {
            const fullname = `${logs[0].Firstname || ""} ${logs[0].Lastname || ""}`.trim();
            const filteredLogs = filterByDate(logs);

            let totalLateMs = 0,
              totalOvertimeMs = 0,
              totalUndertimeMs = 0,
              totalInvalidMs = 0;
            const lateDaysSet = new Set<string>();

            filteredLogs.forEach((log) => {
              const remarks = computeRemarks(log);
              const logDate = new Date(log.date_created);

              const startOfDay = new Date(logDate);
              startOfDay.setHours(8, 1, 0, 0);

              const endOfDay = new Date(logDate);
              endOfDay.setHours(17, 0, 0, 0);

              const invalidStart = new Date(logDate);
              invalidStart.setHours(14, 0, 0, 0);

              if (remarks.startsWith("Late")) {
                totalLateMs += logDate.getTime() - startOfDay.getTime();
                lateDaysSet.add(logDate.toISOString().split("T")[0]);
              } else if (remarks.startsWith("Overtime")) {
                totalOvertimeMs += logDate.getTime() - endOfDay.getTime();
              } else if (remarks.startsWith("Undertime")) {
                totalUndertimeMs += endOfDay.getTime() - logDate.getTime();
              } else if (remarks.startsWith("Invalid")) {
                totalInvalidMs += logDate.getTime() - invalidStart.getTime();
              }
            });

            const lateDays = lateDaysSet.size;

            return (
              <tr key={email} className="whitespace-nowrap hover:bg-blue-50">
                <td className="px-6 py-4 text-xs capitalize">{fullname}</td>
                <td className="px-6 py-4 text-xs">{email}</td>
                <td className="px-6 py-4 text-xs">{logs[0].Department}</td>
                <td className="px-6 py-4 text-xs">{totalLateMs > 0 ? formatDuration(totalLateMs) : "-"}</td>
                <td className="px-6 py-4 text-xs">{totalOvertimeMs > 0 ? formatDuration(totalOvertimeMs) : "-"}</td>
                <td className="px-6 py-4 text-xs">{totalUndertimeMs > 0 ? formatDuration(totalUndertimeMs) : "-"}</td>
                <td className="px-6 py-4 text-xs">{totalInvalidMs > 0 ? formatDuration(totalInvalidMs) : "-"}</td>
                <td className="px-6 py-4 text-xs text-center font-medium text-red-700">
                  {lateDays > 0 ? (lateDays >= 6 ? `${lateDays} (For Memo)` : lateDays) : "-"}
                </td>
                <td className="px-6 py-4 text-xs flex gap-2">
                  <button
                    onClick={() => setOpenModal(email)}
                    className="bg-blue-600 text-white px-2 py-1 rounded text-xs flex items-center gap-1"
                  >
                    <LuLogs size={16} /> View
                  </button>

                  <button
                    onClick={() => setOpenCalendar(email)}
                    className="bg-purple-600 text-white px-2 py-1 rounded text-xs flex items-center gap-1"
                  >
                    <LuCalendarClock size={16} /> Calendar
                  </button>

                  <CalendarModal
                    isOpen={openCalendar === email}
                    logs={filteredLogs}
                    onClose={() => setOpenCalendar(null)}
                  />

                  <button
                    onClick={() =>
                      handleExportExcel(filteredLogs, `${logs[0].Firstname}_${logs[0].Lastname}_Logs`)
                    }
                    className="bg-green-600 text-white px-2 py-1 rounded text-xs flex items-center gap-1"
                  >
                    <LuCloudDownload size={16} /> Download
                  </button>

                  <button
                    onClick={() => {
                      const locations = filteredLogs
                        .filter((l) => l.Latitude && l.Longitude)
                        .map((log) => ({
                          lat: Number(log.Latitude),
                          lng: Number(log.Longitude),
                          name: log.Location || "Unknown",
                        }));
                      setMapCoords(locations);
                      setOpenMap(email);
                    }}
                    className="bg-yellow-600 text-white px-2 py-1 rounded text-xs flex items-center gap-1"
                  >
                    <LuMapPinCheck size={16} /> Map
                  </button>

                  <LogModal
                    isOpen={openModal === email}
                    logs={filteredLogs}
                    onClose={() => setOpenModal(null)}
                    formatDate={formatDate}
                    computeRemarks={computeRemarks}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Map Modal */}
      {mapCoords.length > 0 && openMap && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50">
          <div className="bg-white w-11/12 md:w-4/5 h-[90vh] rounded-lg shadow-lg p-4 relative">
            <button
              onClick={() => setOpenMap(null)}
              className="absolute top-2 right-2 text-gray-600 hover:text-gray-900 font-bold"
            >
              ✕
            </button>
            <MapContainer
              center={[mapCoords[0].lat, mapCoords[0].lng]}
              zoom={16}
              className="w-full h-full rounded"
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a>'
              />
              <FitBounds coords={mapCoords} />
              {mapCoords.map((coord, idx) => (
                <Marker key={idx} position={[coord.lat, coord.lng]} icon={defaultMarker}>
                  <Popup>{coord.name}</Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default CardTable;

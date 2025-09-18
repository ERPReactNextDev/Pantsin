"use client";

import React from "react";
import { ActivityLog } from "../Table";

interface LogModalProps {
    isOpen: boolean;
    logs: ActivityLog[];
    onClose: () => void;
    formatDate: (date: string) => string;
    computeRemarks: (log: ActivityLog) => string;
}

const LogModal: React.FC<LogModalProps> = ({
    isOpen,
    logs,
    onClose,
    formatDate,
    computeRemarks,
}) => {
    if (!isOpen || logs.length === 0) return null;

    const filteredLogs = logs;

    // Compute totals
    let totalLateMs = 0;
    let totalOvertimeMs = 0;
    filteredLogs.forEach((log) => {
        const logDate = new Date(log.date_created);
        const startOfDay = new Date(logDate);
        startOfDay.setHours(8, 1, 0, 0);
        const endOfDay = new Date(logDate);
        endOfDay.setHours(17, 30, 0, 0);

        if (log.Status.toLowerCase() === "login" && logDate > startOfDay) {
            totalLateMs += logDate.getTime() - startOfDay.getTime();
        } else if (log.Status.toLowerCase() === "logout" && logDate > endOfDay) {
            totalOvertimeMs += logDate.getTime() - endOfDay.getTime();
        }
    });

    const formatDuration = (ms: number) => {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((ms % (1000 * 60)) / 1000);
        return `${hours}h ${minutes}m ${seconds}s`;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[999] animate-fadeIn p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 relative flex flex-col max-h-[80vh]">
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-lg font-bold"
                >
                    ✕
                </button>

                <div className="border-b pb-2 mb-4 flex-shrink-0">
                    <h3 className="text-md font-semibold capitalize truncate">
                        {logs[0].Firstname} {logs[0].Lastname} - Activity Logs
                    </h3>
                </div>

                <div className="bg-gray-100 rounded-lg p-3 mb-4 text-xs flex flex-col gap-1">
                    <p className="text-red-600 font-medium">
                        Total Late: {formatDuration(totalLateMs)}
                    </p>
                    <p className="text-blue-600 font-medium">
                        Total Overtime: {formatDuration(totalOvertimeMs)}
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto text-sm space-y-2 pr-2">
                    {filteredLogs.length === 0 ? (
                        <p className="text-gray-400 text-center py-4">
                            No logs found for selected date range.
                        </p>
                    ) : (
                        filteredLogs
                            .sort(
                                (a, b) =>
                                    new Date(a.date_created).getTime() -
                                    new Date(b.date_created).getTime()
                            )
                            .map((log, idx) => {
                                let badgeColor = "bg-gray-300 text-gray-800 text-[10px]";
                                if (log.Status.toLowerCase() === "login")
                                    badgeColor = "bg-green-200 text-green-800 text-[10px]";
                                else if (log.Status.toLowerCase() === "logout")
                                    badgeColor = "bg-red-200 text-red-800 text-[10px]";

                                return (
                                    <div
                                        key={idx}
                                        className="flex justify-between items-center border-b border-gray-200 py-2 px-1 hover:bg-gray-50 rounded"
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-gray-600 text-xs">
                                                {formatDate(log.date_created)}
                                            </span>
                                            <span className="text-gray-500 text-xs italic">
                                                {computeRemarks(log)}
                                            </span>
                                        </div>
                                        <span
                                            className={`px-2 py-0.5 rounded-full font-semibold ${badgeColor}`}
                                        >
                                            {log.Status} | {log.Type}
                                        </span>
                                    </div>
                                );
                            })
                    )}
                </div>
            </div>
        </div>
    );
};

export default LogModal;

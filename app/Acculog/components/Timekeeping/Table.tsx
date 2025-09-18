"use client";

import React, { useState } from "react";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import Filters from "./Filters";
import Card from "./Tab/Card";
import dynamic from "next/dynamic";

// Dynamic import, disable SSR
const CardTable = dynamic(() => import("./Tab/CardTable"), { ssr: false });

export interface ActivityLog {
    ReferenceID: string;
    Email: string;
    Department: string;
    Type: string;
    Status: string;
    date_created: string;
    _id?: string;
    Firstname?: string;
    Lastname?: string;
    profilePicture?: string;
}

interface TableProps {
    groupedByEmail: Record<string, ActivityLog[]>;
    expandedUsers: Record<string, boolean>;
    toggleUserLogs: (email: string) => void;
}

const Table: React.FC<TableProps> = ({ groupedByEmail }) => {
    const [search, setSearch] = useState("");
    const [department, setDepartment] = useState("All");
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");
    const [openModal, setOpenModal] = useState<string | null>(null);

    const [qrModal, setQrModal] = useState<string | null>(null);
    const [qrData, setQrData] = useState<string | null>(null);
    const [qrLoading, setQrLoading] = useState(false);

    const [activeTab, setActiveTab] = useState<"cards" | "table">("cards");
    const [openCalendar, setOpenCalendar] = useState<string | null>(null);

    const formatDate = (date: string) =>
        new Date(date).toLocaleString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            second: "2-digit",
        });

    // 🔹 Format duration helper
    const formatDuration = (ms: number) => {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((ms % (1000 * 60)) / 1000);
        return `${hours}h ${minutes}m ${seconds}s`;
    };

    // 🔹 Compute remarks (Late, Halfday, Undertime, OT, On Time, Invalid)
    const computeRemarks = (log: ActivityLog) => {
        const logDate = new Date(log.date_created);

        // standard working times
        const startOfDay = new Date(logDate);
        startOfDay.setHours(8, 1, 0, 0);

        const morningCutoff = new Date(logDate);
        morningCutoff.setHours(12, 59, 59, 999);

        const halfdayStart = new Date(logDate);
        halfdayStart.setHours(13, 0, 0, 0);

        const invalidStart = new Date(logDate);
        invalidStart.setHours(14, 0, 0, 0); // 2:00 PM

        const invalidEnd = new Date(logDate);
        invalidEnd.setHours(23, 0, 0, 0); // 11:00 PM

        const undertimeStart = new Date(logDate);
        undertimeStart.setHours(13, 0, 0, 0);

        const undertimeEnd = new Date(logDate);
        undertimeEnd.setHours(16, 59, 59, 999);

        const endOfDay = new Date(logDate);
        endOfDay.setHours(17, 0, 0, 0); // ✅ Overtime starts 5:00 PM

        // login rules
        if (log.Status.toLowerCase() === "login") {
            // 🔹 Invalid login (2PM to 11PM)
            if (logDate >= invalidStart && logDate <= invalidEnd) {
                const diffMs = logDate.getTime() - invalidStart.getTime();
                return `Invalid (Needs Verification): ${formatDuration(diffMs)}`;
            }

            if (logDate >= halfdayStart) {
                return "Halfday";
            }
            if (logDate > startOfDay && logDate <= morningCutoff) {
                const diffMs = logDate.getTime() - startOfDay.getTime();
                return `Late: ${formatDuration(diffMs)}`;
            }
            return "On Time";
        }

        // logout rules
        if (log.Status.toLowerCase() === "logout") {
            if (logDate >= undertimeStart && logDate <= undertimeEnd) {
                const diffMs = endOfDay.getTime() - logDate.getTime();
                return `Undertime: ${formatDuration(diffMs)}`;
            }
            if (logDate > endOfDay) {
                const diffMs = logDate.getTime() - endOfDay.getTime();
                return `Overtime: ${formatDuration(diffMs)}`;
            }
            return "On Time";
        }

        return "-";
    };

    // 🔹 Export ALL as ZIP
    const handleExportAll = async () => {
        const zip = new JSZip();

        for (const [email, logs] of Object.entries(groupedByEmail)) {
            const filteredLogs = filterByDate(logs);

            if (filteredLogs.length === 0) continue;

            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet("Logs");

            // ✅ New header
            sheet.addRow([
                "Date",
                "Fullname",
                "Status",
                "Type",
                "Department",
                "Late",
                "Overtime",
                "Undertime",
                "Halfday",
                "Invalid",
            ]);

            let totalLateMs = 0;
            let totalOvertimeMs = 0;
            let totalUndertimeMs = 0;
            let totalInvalidMs = 0;
            let totalHalfday = 0;

            filteredLogs.forEach((log) => {
                const fullname = `${log.Firstname || ""} ${log.Lastname || ""}`.trim();
                const remarks = computeRemarks(log);

                const logDate = new Date(log.date_created);

                // standard refs
                const startOfDay = new Date(logDate);
                startOfDay.setHours(8, 1, 0, 0);

                const endOfDay = new Date(logDate);
                endOfDay.setHours(17, 0, 0, 0);

                const invalidStart = new Date(logDate);
                invalidStart.setHours(14, 0, 0, 0);

                let late = "";
                let overtime = "";
                let undertime = "";
                let halfday = "";
                let invalid = "";

                if (remarks.startsWith("Late")) {
                    late = formatDuration(logDate.getTime() - startOfDay.getTime());
                    totalLateMs += logDate.getTime() - startOfDay.getTime();
                } else if (remarks.startsWith("Overtime")) {
                    overtime = formatDuration(logDate.getTime() - endOfDay.getTime());
                    totalOvertimeMs += logDate.getTime() - endOfDay.getTime();
                } else if (remarks.startsWith("Undertime")) {
                    undertime = formatDuration(endOfDay.getTime() - logDate.getTime());
                    totalUndertimeMs += endOfDay.getTime() - logDate.getTime();
                } else if (remarks.startsWith("Halfday")) {
                    halfday = "Yes";
                    totalHalfday += 1;
                } else if (remarks.startsWith("Invalid")) {
                    invalid = formatDuration(logDate.getTime() - invalidStart.getTime());
                    totalInvalidMs += logDate.getTime() - invalidStart.getTime();
                }

                sheet.addRow([
                    formatDate(log.date_created),
                    fullname,
                    log.Status,
                    log.Type,
                    log.Department,
                    late,
                    overtime,
                    undertime,
                    halfday,
                    invalid,
                ]);
            });

            // 🔹 Append totals
            sheet.addRow([]);
            sheet.addRow(["", "TOTALS"]);
            if (totalLateMs > 0) sheet.addRow(["", "Total Late", formatDuration(totalLateMs)]);
            if (totalOvertimeMs > 0) sheet.addRow(["", "Total Overtime", formatDuration(totalOvertimeMs)]);
            if (totalUndertimeMs > 0) sheet.addRow(["", "Total Undertime", formatDuration(totalUndertimeMs)]);
            if (totalHalfday > 0) sheet.addRow(["", "Total Halfday", totalHalfday]);
            if (totalInvalidMs > 0) sheet.addRow(["", "Total Invalid", formatDuration(totalInvalidMs)]);

            // 🔹 Save buffer per user Excel
            const buffer = await workbook.xlsx.writeBuffer();

            const startLabel = startDate ? startDate.replace(/-/g, "_") : "Start";
            const endLabel = endDate ? endDate.replace(/-/g, "_") : "End";
            const filename = `${logs[0].Firstname}_${logs[0].Lastname}_Timekeeping_${startLabel}_${endLabel}.xlsx`;

            zip.file(filename, buffer);
        }

        const startLabel = startDate ? startDate.replace(/-/g, "_") : "Start";
        const endLabel = endDate ? endDate.replace(/-/g, "_") : "End";
        const zipFilename = `Timekeeping_${startLabel}_${endLabel}.zip`;

        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, zipFilename);
    };

    // 🔹 Export SINGLE Excel
    const handleExportExcel = async (logs: ActivityLog[], filename: string) => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Logs");

        sheet.addRow([
            "Date",
            "Fullname",
            "Status",
            "Type",
            "Department",
            "Late",
            "Overtime",
            "Undertime",
            "Halfday",
            "Invalid",
        ]);

        let totalLateMs = 0;
        let totalOvertimeMs = 0;
        let totalUndertimeMs = 0;
        let totalInvalidMs = 0;
        let totalHalfday = 0;

        logs.forEach((log) => {
            const fullname = `${log.Firstname || ""} ${log.Lastname || ""}`.trim();
            const remarks = computeRemarks(log);

            const logDate = new Date(log.date_created);

            // standard refs
            const startOfDay = new Date(logDate);
            startOfDay.setHours(8, 1, 0, 0);

            const endOfDay = new Date(logDate);
            endOfDay.setHours(17, 0, 0, 0);

            const invalidStart = new Date(logDate);
            invalidStart.setHours(14, 0, 0, 0);

            let late = "";
            let overtime = "";
            let undertime = "";
            let halfday = "";
            let invalid = "";

            if (remarks.startsWith("Late")) {
                late = formatDuration(logDate.getTime() - startOfDay.getTime());
                totalLateMs += logDate.getTime() - startOfDay.getTime();
            } else if (remarks.startsWith("Overtime")) {
                overtime = formatDuration(logDate.getTime() - endOfDay.getTime());
                totalOvertimeMs += logDate.getTime() - endOfDay.getTime();
            } else if (remarks.startsWith("Undertime")) {
                undertime = formatDuration(endOfDay.getTime() - logDate.getTime());
                totalUndertimeMs += endOfDay.getTime() - logDate.getTime();
            } else if (remarks.startsWith("Halfday")) {
                halfday = "Yes";
                totalHalfday += 1;
            } else if (remarks.startsWith("Invalid")) {
                invalid = formatDuration(logDate.getTime() - invalidStart.getTime());
                totalInvalidMs += logDate.getTime() - invalidStart.getTime();
            }

            sheet.addRow([
                formatDate(log.date_created),
                fullname,
                log.Status,
                log.Type,
                log.Department,
                late,
                overtime,
                undertime,
                halfday,
                invalid,
            ]);
        });

        // 🔹 Append totals
        sheet.addRow([]);
        sheet.addRow(["", "TOTALS"]);
        if (totalLateMs > 0) sheet.addRow(["", "Total Late", formatDuration(totalLateMs)]);
        if (totalOvertimeMs > 0) sheet.addRow(["", "Total Overtime", formatDuration(totalOvertimeMs)]);
        if (totalUndertimeMs > 0) sheet.addRow(["", "Total Undertime", formatDuration(totalUndertimeMs)]);
        if (totalHalfday > 0) sheet.addRow(["", "Total Halfday", totalHalfday]);
        if (totalInvalidMs > 0) sheet.addRow(["", "Total Invalid", formatDuration(totalInvalidMs)]);

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        saveAs(blob, `${filename}.xlsx`);

        try {
            const formData = new FormData();
            formData.append("file", blob, `${filename}.xlsx`);

            const res = await fetch("/api/save-excel", {
                method: "POST",
                body: formData,
            });

            if (res.ok) {
                const data = await res.json();
                return `${window.location.origin}${data.url}`;
            } else {
                throw new Error("Upload failed");
            }
        } catch (err) {
            console.error("Upload failed, using Blob URL fallback:", err);
            return URL.createObjectURL(blob);
        }
    };


    // 🔹 Collect all logs for global filtering
    const allLogs = Object.values(groupedByEmail).flat();

    // 🔹 Date filter function (ILIPAT SA ITAAS BAGO GAMITIN)
    const filterByDate = (logs: ActivityLog[]) => {
        const start = startDate ? new Date(startDate + "T00:00:00") : null;
        const end = endDate ? new Date(endDate + "T23:59:59") : null;

        return logs.filter((log) => {
            const logDate = new Date(log.date_created);
            return (!start || logDate >= start) && (!end || logDate <= end);
        });
    };

    // 🔹 Apply filters
    const filteredData = Object.entries(groupedByEmail).filter(
        ([email, logs]) => {
            const fullname = `${logs[0].Firstname || ""} ${logs[0].Lastname || ""}`
                .toLowerCase()
                .trim();

            const matchSearch =
                fullname.includes(search.toLowerCase()) ||
                email.toLowerCase().includes(search.toLowerCase());

            const matchDept =
                department === "All" || logs[0].Department === department;

            // 🔹 Apply date filter (safe na kasi nasa taas na yung filterByDate)
            const filteredLogs = filterByDate(logs);

            return matchSearch && matchDept && filteredLogs.length > 0;
        }
    );


    const departments = [
        "All",
        ...Array.from(new Set(allLogs.map((log) => log.Department))),
    ];

    if (Object.keys(groupedByEmail).length === 0) {
        return (
            <p className="text-gray-400 text-center mt-4">
                No activity logs found.
            </p>
        );
    }

    return (
        <div>
            {/* 🔹 Filters */}
            <Filters
                search={search}
                setSearchAction={setSearch}
                department={department}
                setDepartmentAction={setDepartment}
                startDate={startDate}
                setStartDateAction={setStartDate}
                endDate={endDate}
                setEndDateAction={setEndDate}
                departments={departments}
                allLogs={allLogs}
                handleExportExcelAction={handleExportAll}
                filterByDateAction={filterByDate}
            />

            {/* 🔹 Tabs */}
            <div className="flex border-b mb-4">
                <button
                    onClick={() => setActiveTab("cards")}
                    className={`px-4 py-2 text-sm font-medium ${activeTab === "cards"
                        ? "border-b-2 border-blue-600 text-blue-600"
                        : "text-gray-500 hover:text-gray-700"
                        }`}
                >
                    Cards
                </button>
                <button
                    onClick={() => setActiveTab("table")}
                    className={`px-4 py-2 text-sm font-medium ${activeTab === "table"
                        ? "border-b-2 border-blue-600 text-blue-600"
                        : "text-gray-500 hover:text-gray-700"
                        }`}
                >
                    Table
                </button>
            </div>

            {/* 🔹 User Cards */}
            {activeTab === "cards" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 gap-6">
                    {filteredData.map(([email, logs]) => {
                        const filteredLogs = filterByDate(logs);

                        return (
                            <Card
                                key={email}
                                email={email}
                                logs={logs}
                                filteredLogs={filteredLogs}
                                setOpenModal={setOpenModal}
                                openModal={openModal}
                                qrModal={qrModal}
                                qrData={qrData}
                                qrLoading={qrLoading}
                                setQrModal={setQrModal}
                                setQrData={setQrData}
                                formatDate={formatDate}
                                computeRemarks={computeRemarks}
                                handleExportExcel={handleExportExcel}
                            />
                        );
                    })}
                </div>
            )}

            {activeTab === "table" && (
                <CardTable
                    filteredData={filteredData}
                    setOpenModal={setOpenModal}
                    openModal={openModal}
                    setOpenCalendar={setOpenCalendar}
                    openCalendar={openCalendar}
                    filterByDate={filterByDate}
                    handleExportExcel={handleExportExcel}
                    computeRemarks={computeRemarks}
                    formatDate={formatDate}
                    formatDuration={formatDuration}
                />
            )}


        </div>

    );
};

export default Table;

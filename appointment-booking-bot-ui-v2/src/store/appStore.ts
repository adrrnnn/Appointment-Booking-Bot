import { useState, useCallback } from "react";
import type { DriverState, DriverPreset, ScheduledTask, BotEvent, BookingResult } from "@/types";

const EMPTY_DRIVER = (): DriverState => ({
  driverName: "",
  bookingTokens: [],
  licenseNo: "",
  plateCountry: "SA",
  residentCountry: "SA",
  vehicleSequenceNumber: "",
  chassisNo: "",
  declaration_number: "",
  plateNo: "",
  hourPrefs: { tier1: null, tier2Start: null, tier2End: null },
  status: "idle",
  tokenValid: null,
});

export function useAppStore() {
  const [searchToken, setSearchToken] = useState("");
  const [searchTokenValid, setSearchTokenValid] = useState<boolean | null>(null);
  const [searchTokenChecking, setSearchTokenChecking] = useState(false);
  const [portCode, setPortCode] = useState("41");

  const [drivers, setDrivers] = useState<DriverState[]>([EMPTY_DRIVER()]);

  const [presets, setPresets] = useState<DriverPreset[]>([]);
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [botRunning, setBotRunning] = useState(false);
  const [logs, setLogs] = useState<BotEvent[]>([]);
  const [results, setResults] = useState<BookingResult[]>([]);
  const addResult = useCallback((r: BookingResult) => setResults((prev) => [...prev, r]), []);

  const updateDriver = useCallback((idx: number, patch: Partial<DriverState>) => {
    setDrivers((prev) => prev.map((d, i) => i === idx ? { ...d, ...patch } : d));
  }, []);

  const addDriver = useCallback(() => {
    setDrivers((prev) => {
      if (prev.length >= 4) return prev;
      return [...prev, EMPTY_DRIVER()];
    });
  }, []);

  const removeDriver = useCallback((idx: number) => {
    setDrivers((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  const addLog = useCallback((event: BotEvent) => {
    setLogs((prev) => [...prev.slice(-499), event]);
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  const loadPreset = useCallback((preset: DriverPreset, driverIdx: number) => {
    setDrivers((prev) => prev.map((d, i) =>
      i === driverIdx ? { ...d, ...preset.driver, status: "ready" } : d,
    ));
  }, []);

  return {
    searchToken, setSearchToken,
    searchTokenValid, setSearchTokenValid,
    searchTokenChecking, setSearchTokenChecking,
    portCode, setPortCode,
    drivers, updateDriver, addDriver, removeDriver,
    presets, setPresets,
    scheduledTasks, setScheduledTasks,
    botRunning, setBotRunning,
    logs, addLog, clearLogs,
    results, setResults, addResult,
    loadPreset,
  };
}

export type AppStore = ReturnType<typeof useAppStore>;

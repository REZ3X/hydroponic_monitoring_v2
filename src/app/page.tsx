"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Line } from "react-chartjs-2";
import { addHours, format } from "date-fns";
import { id } from "date-fns/locale/id";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TooltipItem,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface WeatherEntry {
  id: string;
  temperature: number;
  humidity: number;
  timestamp: string;
  water_temp: number;
  connected?: boolean;
}

const timeRanges: TimeRange[] = [
  { value: "minute", label: "1M", fullLabel: "Last Minute" },
  { value: "hour", label: "1H", fullLabel: "Last Hour" },
  { value: "day", label: "1D", fullLabel: "Last Day" },
  { value: "week", label: "1W", fullLabel: "Last Week" },
  { value: "month", label: "1Mo", fullLabel: "Last Month" },
];

interface TimeRange {
  value: string;
  label: string;
  fullLabel: string;
}

export default function Home() {
  const [monitoringData, setMonitoringData] = useState<WeatherEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>("minute");
  const [historicalData, setHistoricalData] = useState<WeatherEntry[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected" | "connecting" | "mqtt-connected"
  >("connecting");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [mqttStatus, setMqttStatus] = useState<
    "connected" | "disconnected" | "connecting"
  >("connecting");

  const convertToJakartaTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return addHours(date, 7);
  };

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let fallbackInterval: NodeJS.Timeout | null = null;
    let connectionTimeout: NodeJS.Timeout | null = null;

    const connectToStream = () => {
      try {
        setConnectionStatus("connecting");
        setMqttStatus("connecting");

        eventSource = new EventSource("/api/stream");

        connectionTimeout = setTimeout(() => {
          if (connectionStatus === "connecting") {
            console.log("SSE connection timeout, switching to fallback");
            eventSource?.close();
            startFallbackPolling();
          }
        }, 10000);

        eventSource.onopen = () => {
          console.log("SSE connection opened");
          setConnectionStatus("mqtt-connected");
          setMqttStatus("connected");
          if (connectionTimeout) clearTimeout(connectionTimeout);
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === "connected") {
              console.log("Connected to MQTT stream");
              return;
            }

            if (
              data.temperature !== null &&
              data.humidity !== null &&
              data.water_temp !== null
            ) {
              const newEntry: WeatherEntry = {
                id: data.id,
                temperature: data.temperature,
                humidity: data.humidity,
                water_temp: data.water_temp,
                timestamp: convertToJakartaTime(data.timestamp).toISOString(),
                connected: true,
              };

              setMonitoringData((prev) => {
                const updated = [...prev, newEntry];
                return updated.slice(-50);
              });

              setLastUpdate(new Date());
              setConnectionStatus("mqtt-connected");
              setMqttStatus("connected");
              setLoading(false);
            }
          } catch (error) {
            console.error("Error parsing SSE data:", error);
          }
        };

        eventSource.onerror = (error) => {
          console.error("SSE connection error:", error);
          setConnectionStatus("disconnected");
          setMqttStatus("disconnected");

          eventSource?.close();

          setTimeout(() => {
            if (connectionStatus === "disconnected") {
              startFallbackPolling();
            }
          }, 5000);
        };
      } catch (error) {
        console.error("Failed to connect to SSE:", error);
        setConnectionStatus("disconnected");
        setMqttStatus("disconnected");
        startFallbackPolling();
      }
    };

    const startFallbackPolling = () => {
      setConnectionStatus("connected");
      setMqttStatus("disconnected");

      fallbackInterval = setInterval(async () => {
        try {
          const response = await fetch("/api/realtime");
          const data = await response.json();

          if (Array.isArray(data) && data.length > 0) {
            const entry = data[0];
            const newEntry: WeatherEntry = {
              ...entry,
              timestamp: convertToJakartaTime(entry.timestamp).toISOString(),
            };

            setMonitoringData((prev) => {
              const updated = [...prev, newEntry];
              return updated.slice(-50);
            });

            setConnectionStatus("connected");
            setLastUpdate(new Date());
            setLoading(false);
          }
        } catch (error) {
          console.error("Failed to fetch fallback data:", error);
          setConnectionStatus("disconnected");
        }
      }, 3000);
    };

    connectToStream();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
      }
    };
  }, []);

  useEffect(() => {
    async function fetchHistoricalData() {
      try {
        console.log(`Fetching historical data for range: ${selectedTimeRange}`);
        const response = await fetch(`/api/history?range=${selectedTimeRange}`);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Raw historical data response:", data);
        console.log("Is array?", Array.isArray(data));
        console.log("Length:", Array.isArray(data) ? data.length : "N/A");

        if (Array.isArray(data)) {
          const processedData = data.map((entry: WeatherEntry) => ({
            ...entry,
            timestamp: convertToJakartaTime(entry.timestamp).toISOString(),
          }));

          console.log("Processed historical data:", processedData.slice(0, 3));
          setHistoricalData(processedData);
        } else {
          console.error("Historical data is not an array:", data);
          setHistoricalData([]);
        }
      } catch (error) {
        console.error("Failed to fetch historical data:", error);
        setHistoricalData([]);
      }
    }

    fetchHistoricalData();
  }, [selectedTimeRange]);

  const getWaterTempColor = (temp: number) => {
    if (temp > 30) return "from-red-500/20 to-red-600/20 border-red-500/30";
    if (temp < 20) return "from-blue-500/20 to-cyan-500/20 border-cyan-500/30";
    return "from-teal-500/20 to-emerald-500/20 border-emerald-500/30";
  };

  const getTemperatureColor = (temp: number) => {
    if (temp > 30) return "from-orange-500/20 to-red-500/20 border-red-500/30";
    if (temp < 20) return "from-blue-500/20 to-cyan-500/20 border-cyan-500/30";
    return "from-green-500/20 to-emerald-500/20 border-emerald-500/30";
  };

  const getHumidityColor = (humidity: number) => {
    if (humidity > 80)
      return "from-blue-500/20 to-indigo-500/20 border-indigo-500/30";
    if (humidity < 40)
      return "from-yellow-500/20 to-orange-500/20 border-orange-500/30";
    return "from-emerald-500/20 to-teal-500/20 border-teal-500/30";
  };

  const getStatusColor = (type: string, value: number) => {
    switch (type) {
      case "temperature":
        if (value > 35 || value < 15) return "text-red-400";
        if (value > 30 || value < 18) return "text-yellow-400";
        return "text-emerald-400";
      case "humidity":
        if (value > 85 || value < 35) return "text-red-400";
        if (value > 80 || value < 40) return "text-yellow-400";
        return "text-emerald-400";
      case "waterTemp":
        if (value > 30 || value < 18) return "text-red-400";
        if (value > 28 || value < 20) return "text-yellow-400";
        return "text-emerald-400";
      default:
        return "text-gray-400";
    }
  };

  const getTimeFormat = (range: string) => {
    switch (range) {
      case "minute":
        return "HH:mm:ss";
      case "hour":
        return "HH:mm";
      case "day":
        return "HH:mm";
      case "week":
        return "MM/dd HH:mm";
      case "month":
        return "MM/dd";
      default:
        return "HH:mm:ss";
    }
  };

  const getChartOptions = (dataSource: WeatherEntry[], timeRange: string) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        titleColor: "rgb(226, 232, 240)",
        bodyColor: "rgb(203, 213, 225)",
        borderColor: "rgba(71, 85, 105, 0.5)",
        borderWidth: 1,
        cornerRadius: 6,
        padding: 12,
        callbacks: {
          title: (context: TooltipItem<"line">[]) => {
            const index = context[0].dataIndex;
            const timestamp = dataSource[index]?.timestamp;
            if (!timestamp) return "";
            return format(
              new Date(timestamp),
              timeRange === "minute" ? "HH:mm:ss" : "yyyy-MM-dd HH:mm:ss",
              { locale: id }
            );
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        grid: {
          color: "rgba(71, 85, 105, 0.2)",
          drawBorder: false,
        },
        ticks: {
          maxTicksLimit: 6,
          color: "rgb(148, 163, 184)",
          font: {
            size: 11,
          },
          callback: function (value: number | string, index: number) {
            const entry = dataSource[index];
            if (!entry?.timestamp) return "";
            return format(new Date(entry.timestamp), getTimeFormat(timeRange), {
              locale: id,
            });
          },
        },
      },
      y: {
        beginAtZero: false,
        grid: {
          color: "rgba(71, 85, 105, 0.2)",
          drawBorder: false,
        },
        ticks: {
          color: "rgb(148, 163, 184)",
          font: {
            size: 11,
          },
        },
      },
    },
  });

  const createChartData = (
    data: WeatherEntry[],
    key: keyof WeatherEntry,
    label: string,
    color: string,
    isRealTime: boolean = false
  ) => {
    const displayData = isRealTime ? data.slice(-10) : data;
    return {
      labels:
        displayData?.map((d) =>
          d?.timestamp
            ? format(new Date(d.timestamp), "HH:mm:ss", { locale: id })
            : ""
        ) || [],
      datasets: [
        {
          label,
          data: displayData?.map((d) => Number(d[key])) || [],
          borderColor: color,
          backgroundColor: `${color}15`,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: color,
          pointBorderColor: "rgb(30, 41, 59)",
          pointBorderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 2,
        },
      ],
    };
  };

  const ConnectionIndicator = () => (
    <div className="flex flex-wrap items-center justify-center gap-3 text-xs sm:text-sm">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/50 border border-slate-700/50">
        <div
          className={`w-1.5 h-1.5 rounded-full ${
            connectionStatus === "mqtt-connected"
              ? "bg-emerald-400 animate-pulse"
              : connectionStatus === "connected"
              ? "bg-blue-400 animate-pulse"
              : connectionStatus === "connecting"
              ? "bg-yellow-400 animate-pulse"
              : "bg-red-400"
          }`}
        />
        <span
          className={`font-medium ${
            connectionStatus === "mqtt-connected"
              ? "text-emerald-400"
              : connectionStatus === "connected"
              ? "text-blue-400"
              : connectionStatus === "connecting"
              ? "text-yellow-400"
              : "text-red-400"
          }`}
        >
          {connectionStatus === "mqtt-connected"
            ? "MQTT Live"
            : connectionStatus === "connected"
            ? "Connected"
            : connectionStatus === "connecting"
            ? "Connecting"
            : "Disconnected"}
        </span>
      </div>

      {lastUpdate && connectionStatus !== "disconnected" && (
        <span className="text-slate-400 px-3 py-1.5 rounded-full bg-slate-800/50 border border-slate-700/50">
          {format(lastUpdate, "HH:mm:ss")}
        </span>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 p-3 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-6 lg:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-100 mb-3">
            Hydroponic Monitor
          </h1>
          <p className="text-sm text-slate-400 mb-4">
            Real-time environmental tracking
          </p>
          <ConnectionIndicator />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 lg:mb-8">
          {loading
            ? Array(3)
                .fill(null)
                .map((_, i) => (
                  <Card key={i} className="border-slate-800/50">
                    <CardContent className="p-4 sm:p-6">
                      <Skeleton className="h-[280px] w-full rounded-lg" />
                    </CardContent>
                  </Card>
                ))
            : monitoringData.length > 0 && (
                <>
                  <Card className="bg-slate-900/50 backdrop-blur border-slate-800/50 hover:border-slate-700/50 transition-all duration-300">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold text-slate-200 flex items-center justify-between">
                        <span>Air Temp</span>
                        {connectionStatus === "mqtt-connected" && (
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            LIVE
                          </span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="flex flex-col items-center space-y-3">
                        <div
                          className={`w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br ${getTemperatureColor(
                            monitoringData[monitoringData.length - 1]
                              .temperature
                          )} flex items-center justify-center border backdrop-blur-sm`}
                        >
                          <div className="text-center">
                            <span className="text-3xl font-bold block text-slate-100">
                              {monitoringData[
                                monitoringData.length - 1
                              ].temperature.toFixed(1)}
                            </span>
                            <span className="text-xs text-slate-300">°C</span>
                          </div>
                        </div>
                        <div
                          className={`text-xs font-medium ${getStatusColor(
                            "temperature",
                            monitoringData[monitoringData.length - 1]
                              .temperature
                          )}`}
                        >
                          {monitoringData[monitoringData.length - 1]
                            .temperature > 35 ||
                          monitoringData[monitoringData.length - 1]
                            .temperature < 15
                            ? "Critical"
                            : monitoringData[monitoringData.length - 1]
                                .temperature > 30 ||
                              monitoringData[monitoringData.length - 1]
                                .temperature < 18
                            ? "Warning"
                            : "Optimal"}
                        </div>
                        <div className="w-full h-[120px] sm:h-[140px]">
                          <Line
                            options={getChartOptions(monitoringData, "minute")}
                            data={createChartData(
                              monitoringData,
                              "temperature",
                              "Temperature",
                              "rgb(239, 68, 68)",
                              true
                            )}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-900/50 backdrop-blur border-slate-800/50 hover:border-slate-700/50 transition-all duration-300">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold text-slate-200 flex items-center justify-between">
                        <span>Humidity</span>
                        {connectionStatus === "mqtt-connected" && (
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            LIVE
                          </span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="flex flex-col items-center space-y-3">
                        <div
                          className={`w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br ${getHumidityColor(
                            monitoringData[monitoringData.length - 1].humidity
                          )} flex items-center justify-center border backdrop-blur-sm`}
                        >
                          <div className="text-center">
                            <span className="text-3xl font-bold block text-slate-100">
                              {monitoringData[
                                monitoringData.length - 1
                              ].humidity.toFixed(0)}
                            </span>
                            <span className="text-xs text-slate-300">%</span>
                          </div>
                        </div>
                        <div
                          className={`text-xs font-medium ${getStatusColor(
                            "humidity",
                            monitoringData[monitoringData.length - 1].humidity
                          )}`}
                        >
                          {monitoringData[monitoringData.length - 1].humidity >
                            85 ||
                          monitoringData[monitoringData.length - 1].humidity <
                            35
                            ? "Critical"
                            : monitoringData[monitoringData.length - 1]
                                .humidity > 80 ||
                              monitoringData[monitoringData.length - 1]
                                .humidity < 40
                            ? "Warning"
                            : "Optimal"}
                        </div>
                        <div className="w-full h-[120px] sm:h-[140px]">
                          <Line
                            options={getChartOptions(monitoringData, "minute")}
                            data={createChartData(
                              monitoringData,
                              "humidity",
                              "Humidity",
                              "rgb(59, 130, 246)",
                              true
                            )}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-900/50 backdrop-blur border-slate-800/50 hover:border-slate-700/50 transition-all duration-300 sm:col-span-2 lg:col-span-1">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold text-slate-200 flex items-center justify-between">
                        <span>Water Temp</span>
                        {connectionStatus === "mqtt-connected" && (
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            LIVE
                          </span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="flex flex-col items-center space-y-3">
                        <div
                          className={`w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br ${getWaterTempColor(
                            monitoringData[monitoringData.length - 1].water_temp
                          )} flex items-center justify-center border backdrop-blur-sm`}
                        >
                          <div className="text-center">
                            <span className="text-3xl font-bold block text-slate-100">
                              {monitoringData[
                                monitoringData.length - 1
                              ].water_temp.toFixed(1)}
                            </span>
                            <span className="text-xs text-slate-300">°C</span>
                          </div>
                        </div>
                        <div
                          className={`text-xs font-medium ${getStatusColor(
                            "waterTemp",
                            monitoringData[monitoringData.length - 1].water_temp
                          )}`}
                        >
                          {monitoringData[monitoringData.length - 1]
                            .water_temp > 30 ||
                          monitoringData[monitoringData.length - 1].water_temp <
                            18
                            ? "Critical"
                            : monitoringData[monitoringData.length - 1]
                                .water_temp > 28 ||
                              monitoringData[monitoringData.length - 1]
                                .water_temp < 20
                            ? "Warning"
                            : "Optimal"}
                        </div>
                        <div className="w-full h-[120px] sm:h-[140px]">
                          <Line
                            options={getChartOptions(monitoringData, "minute")}
                            data={createChartData(
                              monitoringData,
                              "water_temp",
                              "Water Temperature",
                              "rgb(20, 184, 166)",
                              true
                            )}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
        </div>

        <Card className="bg-slate-900/50 backdrop-blur border-slate-800/50">
          <CardHeader className="border-b border-slate-800/50">
            <CardTitle className="text-lg sm:text-xl font-bold text-slate-100">
              Historical Data
            </CardTitle>
            <p className="text-xs text-slate-400 mt-1">
              Track performance over time
            </p>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 lg:p-6">
            <div className="flex flex-wrap gap-2 mb-6">
              {timeRanges.map((range) => (
                <button
                  key={range.value}
                  onClick={() => setSelectedTimeRange(range.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    selectedTimeRange === range.value
                      ? "bg-blue-500 text-white"
                      : "bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-300 border border-slate-700/50"
                  }`}
                  title={range.fullLabel}
                >
                  <span className="block sm:hidden">{range.label}</span>
                  <span className="hidden sm:block">{range.fullLabel}</span>
                </button>
              ))}
            </div>

            <div className="space-y-4 sm:space-y-6">
              <div className="bg-slate-800/30 backdrop-blur rounded-xl p-3 sm:p-4 border border-slate-700/30">
                <h3 className="text-sm sm:text-base font-semibold text-slate-200 mb-3 flex items-center gap-2">
                  <span>Temperature</span>
                  <span className="text-xs font-normal text-slate-400">
                    (
                    {
                      timeRanges.find((r) => r.value === selectedTimeRange)
                        ?.fullLabel
                    }
                    )
                  </span>
                </h3>
                <div className="h-[200px] sm:h-[240px]">
                  <Line
                    options={getChartOptions(historicalData, selectedTimeRange)}
                    data={createChartData(
                      historicalData,
                      "temperature",
                      "Temperature",
                      "rgb(239, 68, 68)"
                    )}
                  />
                </div>
              </div>

              <div className="bg-slate-800/30 backdrop-blur rounded-xl p-3 sm:p-4 border border-slate-700/30">
                <h3 className="text-sm sm:text-base font-semibold text-slate-200 mb-3 flex items-center gap-2">
                  <span>Humidity</span>
                  <span className="text-xs font-normal text-slate-400">
                    (
                    {
                      timeRanges.find((r) => r.value === selectedTimeRange)
                        ?.fullLabel
                    }
                    )
                  </span>
                </h3>
                <div className="h-[200px] sm:h-[240px]">
                  <Line
                    options={getChartOptions(historicalData, selectedTimeRange)}
                    data={createChartData(
                      historicalData,
                      "humidity",
                      "Humidity",
                      "rgb(59, 130, 246)"
                    )}
                  />
                </div>
              </div>

              <div className="bg-slate-800/30 backdrop-blur rounded-xl p-3 sm:p-4 border border-slate-700/30">
                <h3 className="text-sm sm:text-base font-semibold text-slate-200 mb-3 flex items-center gap-2">
                  <span>Water Temperature</span>
                  <span className="text-xs font-normal text-slate-400">
                    (
                    {
                      timeRanges.find((r) => r.value === selectedTimeRange)
                        ?.fullLabel
                    }
                    )
                  </span>
                </h3>
                <div className="h-[200px] sm:h-[240px]">
                  <Line
                    options={getChartOptions(historicalData, selectedTimeRange)}
                    data={createChartData(
                      historicalData,
                      "water_temp",
                      "Water Temperature",
                      "rgb(20, 184, 166)"
                    )}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-6 text-xs text-slate-500">
          <p>Hydroponic Monitoring System</p>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE } from "./src/app/api/axiosClient"; // ✅ мұнда ./src/config деп емес, тек ./config деп жаз

function Test() {
  const [data, setData] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("📡 API URL:", API_BASE);

        const response = await axios.get(`${API_BASE}/info`);
        console.log("✅ Backend response:", response.data);

        setData(JSON.stringify(response.data));
      } catch (error: any) {
        console.error("❌ Axios error:", error.message);
        setData("Қате: серверге қосылу мүмкін емес");
      }
    };

    fetchData();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-800">
      <h1 className="text-2xl font-semibold mb-4">
        🌐 FastAPI байланысын тексеру
      </h1>
      <div className="p-4 bg-white rounded-2xl shadow w-96 text-center">
        <p>{data || "Жүктелуде..."}</p>
      </div>
    </div>
  );
}

export default Test;

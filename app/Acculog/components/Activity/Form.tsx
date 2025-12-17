import React, { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import Camera from "./Camera";

interface FormData {
  ReferenceID: string;
  Email: string;
  Type: string;
  Status: string;
  PhotoURL?: string;
  Remarks: string
  _id?: string;
}

interface UserDetails {
  ReferenceID: string;
  Email: string;
}

interface FormProps {
  formData: FormData;
  onChange: (field: keyof FormData, value: string) => void;
  userDetails: UserDetails;
  fetchAccount: () => Promise<void>;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
  setShowForm: React.Dispatch<React.SetStateAction<boolean>>;
}

const Form: React.FC<FormProps> = ({
  formData,
  onChange,
  userDetails,
  fetchAccount,
  setForm,
  setShowForm,
}) => {
  const [locationAddress, setLocationAddress] = useState<string>("Fetching location...");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [lastStatus, setLastStatus] = useState<"Login" | "Logout" | null>(null);
  const [lastTime, setLastTime] = useState<string | null>(null);

  // Start camera and get location
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        streamRef.current = stream;
      })
      .catch((err) => {
        console.error("Camera error:", err);
        toast.error("Cannot access camera");
      });

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLatitude(coords.latitude);
        setLongitude(coords.longitude);

        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}`)
          .then((res) => res.json())
          .then((data) => {
            setLocationAddress(data.display_name || `${coords.latitude}, ${coords.longitude}`);
          })
          .catch(() => {
            setLocationAddress(`${coords.latitude}, ${coords.longitude}`);
          });
      },
      () => {
        setLocationAddress("Location unavailable");
      }
    );

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    const fetchLastStatus = async () => {
      try {
        const res = await fetch(
          `/api/ModuleSales/Activity/LastStatus?referenceId=${userDetails.ReferenceID}`
        );
        if (!res.ok) return;

        const data = await res.json();

        if (data?.Status) {
          setLastStatus(data.Status);
          setLastTime(
            new Date(data.date_created).toLocaleTimeString("en-PH", {
              hour: "2-digit",
              minute: "2-digit",
            })
          );
        } else {
          setLastStatus(null);
          setLastTime(null);
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchLastStatus();
  }, [userDetails.ReferenceID]);

  const uploadToCloudinary = async (base64Image: string): Promise<string> => {
    const formData = new FormData();
    formData.append("file", base64Image);
    formData.append("upload_preset", "Xchire");
    const res = await fetch("https://api.cloudinary.com/v1_1/dhczsyzcz/image/upload", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    return data.secure_url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!capturedImage) {
        toast.error("Please capture a photo first.");
        return;
      }

      setUploading(true);
      const photoURL = await uploadToCloudinary(capturedImage);

      const method = formData._id ? "PUT" : "POST";
      const url = formData._id
        ? `/api/ModuleSales/Activity/UpdateLog?id=${formData._id}`
        : `/api/ModuleSales/Activity/AddLog`;

      const payload = {
        ...formData,
        Location: locationAddress,
        Latitude: latitude,
        Longitude: longitude,
        PhotoURL: photoURL,
      };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();

        if (response.status === 409) {
          toast.warning(errorData.error || "Login already submitted today.");
          return;
        }

        throw new Error(errorData.error || "Failed to save");
      }

      toast.success(formData._id ? "Activity updated!" : "Activity added!");
      setCapturedImage(null);
      setForm({
        ReferenceID: userDetails.ReferenceID,
        Email: userDetails.Email,
        Type: "",
        Status: "",
        PhotoURL: "",
        Remarks: "",
        _id: undefined,
      });
      setShowForm(false);
      await fetchAccount();
    } catch (err) {
      console.error(err);
      toast.error("Error saving activity.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998] transition-opacity duration-300"
        onClick={() => setShowForm(false)}
      />

      <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative p-6 animate-fadeIn 
                      max-h-[90vh] overflow-y-auto">

          {/* Close button */}
          <button
            onClick={() => setShowForm(false)}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 transition-colors duration-200 text-lg"
          >
            &times;
          </button>

          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            <h3 className="text-base font-semibold text-gray-800 border-b pb-2">
              {formData._id ? "✏️ Update Activity" : "➕ Add Activity"}
            </h3>

            {lastStatus && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
                <p>
                  <strong>Current Status:</strong>{" "}
                  <span
                    className={
                      lastStatus === "Login"
                        ? "text-green-600 font-semibold"
                        : "text-red-600 font-semibold"
                    }
                  >
                    {lastStatus === "Login" ? "Logged In" : "Logged Out"}
                  </span>
                </p>

                {lastTime && (
                  <p className="text-gray-500 mt-1">
                    Last activity: {lastTime}
                  </p>
                )}
              </div>
            )}


            {/* Type */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-black focus:outline-none transition-all"
                value={formData.Type}
                onChange={(e) => onChange("Type", e.target.value)}
                required
              >
                <option value="">Select Type</option>
                <option value="On Field">On Field</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select
  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs
             focus:ring-2 focus:ring-black focus:outline-none transition-all"
  value={formData.Status}
  onChange={(e) => onChange("Status", e.target.value)}
  required
>
  <option value="">Select Status</option>

  <option
    value="Login"
    disabled={lastStatus === "Login"}
  >
    Login {lastStatus === "Login" ? "(Current)" : ""}
  </option>

  <option
    value="Logout"
    disabled={lastStatus === "Logout"}
  >
    Logout {lastStatus === "Logout" ? "(Current)" : ""}
  </option>
</select>

            </div>

            {/* Remarks */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Remarks/Status</label>
              <textarea
                value={formData.Remarks}
                onChange={(e) => onChange("Remarks", e.target.value)} // ✅ dito
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-gray-50"
                rows={5}
              />


            </div>

            {/* Location */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
              <input
                type="text"
                value={locationAddress}
                disabled
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs bg-gray-50"
              />
            </div>

            {/* Hidden Lat/Lng */}
            <input type="hidden" value={latitude ?? ""} />
            <input type="hidden" value={longitude ?? ""} />

            {/* Camera */}
            <div className="mt-2">
              <Camera onCapture={(img) => setCapturedImage(img)} />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full bg-black hover:bg-gray-900 text-white px-4 py-2 rounded-lg text-sm mt-3 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              disabled={
                !formData.Type ||
                !formData.Status ||
                uploading ||
                !capturedImage ||
                !locationAddress ||
                locationAddress === "Location unavailable" ||
                locationAddress === "Fetching location..."
              }
            >
              {uploading
                ? "⏳ Uploading..."
                : formData._id
                  ? "💾 Update"
                  : "✅ Submit"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default Form;

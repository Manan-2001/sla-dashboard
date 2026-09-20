"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuthToken } from "@/lib/auth";

export default function HomePage() {
const router = useRouter();

useEffect(() => {
    const token = getAuthToken();

    if (token) {
        router.replace("/dashboard");
    } else {
        router.replace("/login");
    }
}, [router]);

return (
    <div
        style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Arial, sans-serif",
        }}
    >
        Loading...
    </div>
);

}

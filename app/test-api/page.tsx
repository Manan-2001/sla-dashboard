"use client";

import { useEffect, useState } from "react";
import { getHealth } from "@/lib/api";

export default function TestApiPage() {
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function testApi() {
            try {
                const result = await getHealth();

                setData(result);
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "API request failed"
                );
            }
        }

        testApi();
    }, []);

    return (
        <main
            style={{
                padding: "40px",
                fontFamily: "Arial, sans-serif",
            }}
        >
            <h1>Worker API Test</h1>

            {error && (
                <div
                    style={{
                        color: "red",
                        marginTop: "20px",
                    }}
                >
                    Error: {error}
                </div>
            )}

            {data && (
                <pre
                    style={{
                        marginTop: "20px",
                        padding: "20px",
                        background: "#f5f5f5",
                        borderRadius: "8px",
                        whiteSpace: "pre-wrap",
                    }}
                >
                    {JSON.stringify(data, null, 2)}
                </pre>
            )}

            {!data && !error && (
                <p>Connecting to Worker...</p>
            )}
        </main>
    );
}
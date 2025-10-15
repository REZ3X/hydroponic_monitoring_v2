// API Route: Register Device for Push Notifications
// POST /api/register-device

import { NextRequest, NextResponse } from "next/server";
import { registerDevice, unregisterDevice } from "@/lib/monitoringService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: "Push token is required" },
        { status: 400 }
      );
    }

    const success = registerDevice(token);

    if (success) {
      return NextResponse.json({
        success: true,
        message: "Device registered for notifications",
      });
    } else {
      return NextResponse.json(
        { error: "Invalid push token" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error registering device:", error);
    return NextResponse.json(
      { error: "Failed to register device" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: "Push token is required" },
        { status: 400 }
      );
    }

    const success = unregisterDevice(token);

    if (success) {
      return NextResponse.json({
        success: true,
        message: "Device unregistered",
      });
    } else {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }
  } catch (error) {
    console.error("Error unregistering device:", error);
    return NextResponse.json(
      { error: "Failed to unregister device" },
      { status: 500 }
    );
  }
}

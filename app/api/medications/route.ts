import { NextRequest, NextResponse } from "next/server";
import {
  getMedicationsAction,
  createMedicationAction,
} from "../../actions/medicationActions";

/**
 * Medications API Route Handler
 * GET /api/medications - Fetch all medication records from Supabase
 * POST /api/medications - Create a new medication record in Supabase
 */
export async function GET() {
  try {
    const result = await getMedicationsAction();
    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "SERVER_ERROR", message: err.message || "Failed to fetch medications" },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.name || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "ชื่อยา (name) เป็นข้อมูลที่จำเป็น" },
        },
        { status: 400 }
      );
    }

    const result = await createMedicationAction({
      name: body.name.trim(),
      size: body.size !== undefined ? String(body.size) : undefined,
      unit: body.unit !== undefined ? String(body.unit) : undefined,
      price: body.price !== undefined ? body.price : undefined,
      description: body.description !== undefined ? String(body.description) : undefined,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "SERVER_ERROR", message: err.message || "Failed to create medication" },
      },
      { status: 500 }
    );
  }
}

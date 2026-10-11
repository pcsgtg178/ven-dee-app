import { NextRequest, NextResponse } from "next/server";
import {
  updateMedicationAction,
  deleteMedicationAction,
} from "../../../actions/medicationActions";

/**
 * Medications Item API Route Handler
 * PUT /api/medications/[id] - Update medication record in Supabase
 * DELETE /api/medications/[id] - Delete medication record from Supabase
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Missing medication ID" } },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Missing request body" } },
        { status: 400 }
      );
    }

    const result = await updateMedicationAction(id, {
      name: body.name !== undefined ? String(body.name).trim() : undefined,
      size: body.size !== undefined ? String(body.size).trim() : undefined,
      unit: body.unit !== undefined ? String(body.unit).trim() : undefined,
      price: body.price !== undefined ? body.price : undefined,
      description: body.description !== undefined ? String(body.description).trim() : undefined,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "SERVER_ERROR", message: err.message || "Failed to update medication" },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Missing medication ID" } },
        { status: 400 }
      );
    }

    const result = await deleteMedicationAction(id);
    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "SERVER_ERROR", message: err.message || "Failed to delete medication" },
      },
      { status: 500 }
    );
  }
}

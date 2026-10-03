-- Migration: add companions to Project
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "companions" JSONB NOT NULL DEFAULT '[]';

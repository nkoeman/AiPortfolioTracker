-- Add exposure sources for additional issuers
ALTER TYPE "ExposureSource" ADD VALUE IF NOT EXISTS 'VANGUARD';
ALTER TYPE "ExposureSource" ADD VALUE IF NOT EXISTS 'SPDR';
ALTER TYPE "ExposureSource" ADD VALUE IF NOT EXISTS 'COMGEST';
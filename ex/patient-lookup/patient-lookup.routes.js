import express from 'express'
import { lookupPatient } from './patient-lookup.controller.js'
import { authenticateToken } from '../middlewares/auth.middleware.js'

const router = express.Router()

// GET /api/v1/patients/lookup?cn=xxx&stationId=1
router.get('/lookup', authenticateToken, lookupPatient)

export default router

import { Router } from "express";
import {
    createTicket,
    getUserTickets,
    getTicket,
    addMessage,
    getAllTickets,
    getAdminTicket,
    addAdminMessage,
    updateTicketStatus,
    assignTicket,
    getUnassignedCount,
    getAssignedTickets
} from "../controllers/support.controller.js";
import auth from "../middleware/auth.js";
import { admin as Admin } from "../middleware/Admin.js";

const router = Router();

// User routes (require authentication)
router.use(auth);

// User endpoints
router.post("/tickets", createTicket);
router.get("/tickets", getUserTickets);
router.get("/tickets/:ticketId", getTicket);
router.post("/tickets/:ticketId/messages", addMessage);

// Admin routes (require admin authentication)
router.use(Admin);

// Admin endpoints
router.get("/admin/tickets", getAllTickets);
router.get("/admin/tickets/:ticketId", getAdminTicket);
router.post("/admin/tickets/:ticketId/messages", addAdminMessage);
router.patch("/admin/tickets/:ticketId/status", updateTicketStatus);
router.patch("/admin/tickets/:ticketId/assign", assignTicket);
router.get("/admin/unassigned-count", getUnassignedCount);
router.get("/admin/assigned-tickets", getAssignedTickets);

export default router;

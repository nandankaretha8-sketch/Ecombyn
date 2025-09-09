import SupportTicket from "../models/supportTicket.model.js";
import UserModel from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Create a new support ticket
const createTicket = asyncHandler(async (req, res) => {
    try {
        console.log("CreateTicket - Request body:", req.body);
        console.log("CreateTicket - User ID:", req.userId);

        const { subject, category, priority, message } = req.body;
        const userId = req.userId;

        if (!subject || !message) {
            throw new ApiError(400, "Subject and message are required");
        }

        console.log("CreateTicket - Creating ticket with data:", {
            user: userId,
            subject,
            category: category || "GENERAL",
            priority: priority || "MEDIUM"
        });

        const ticket = await SupportTicket.create({
            user: userId,
            subject,
            category: category || "GENERAL",
            priority: priority || "MEDIUM",
            messages: [{
                sender: "USER",
                message,
                timestamp: new Date()
            }]
        });

        console.log("CreateTicket - Ticket created:", ticket._id);

        const populatedTicket = await SupportTicket.findById(ticket._id)
            .populate("user", "name email avatar")
            .populate("assignedTo", "name email");

        console.log("CreateTicket - Populated ticket:", populatedTicket);

        res.status(201).json(
            new ApiResponse(201, populatedTicket, "Support ticket created successfully")
        );
    } catch (error) {
        console.error("CreateTicket - Error:", error);
        throw error;
    }
});

// Get user's tickets
const getUserTickets = asyncHandler(async (req, res) => {
    const userId = req.userId;
    const { status, page = 1, limit = 10 } = req.query;

    const query = { user: userId };
    if (status) {
        query.status = status.toUpperCase();
    }

    const skip = (page - 1) * limit;

    const tickets = await SupportTicket.find(query)
        .populate("user", "name email avatar")
        .populate("assignedTo", "name email")
        .sort({ lastMessage: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await SupportTicket.countDocuments(query);

    res.status(200).json(
        new ApiResponse(200, {
            tickets,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        }, "Tickets retrieved successfully")
    );
});

// Get single ticket with messages
const getTicket = asyncHandler(async (req, res) => {
    const { ticketId } = req.params;
    const userId = req.userId;

    const ticket = await SupportTicket.findOne({
        _id: ticketId,
        user: userId
    }).populate("user", "name email avatar")
      .populate("assignedTo", "name email");

    if (!ticket) {
        throw new ApiError(404, "Ticket not found");
    }

    // Mark messages as read if user is viewing
    await SupportTicket.updateMany(
        { _id: ticketId, "messages.sender": "ADMIN", "messages.isRead": false },
        { $set: { "messages.$.isRead": true } }
    );

    res.status(200).json(
        new ApiResponse(200, ticket, "Ticket retrieved successfully")
    );
});

// Add message to ticket
const addMessage = asyncHandler(async (req, res) => {
    const { ticketId } = req.params;
    const { message } = req.body;
    const userId = req.userId;

    if (!message) {
        throw new ApiError(400, "Message is required");
    }

    const ticket = await SupportTicket.findOne({
        _id: ticketId,
        user: userId
    });

    if (!ticket) {
        throw new ApiError(404, "Ticket not found");
    }

    if (ticket.status === "CLOSED") {
        throw new ApiError(400, "Cannot add message to closed ticket");
    }

    ticket.messages.push({
        sender: "USER",
        message,
        timestamp: new Date()
    });

    ticket.lastMessage = new Date();
    if (ticket.status === "RESOLVED") {
        ticket.status = "IN_PROGRESS";
    }

    await ticket.save();

    const updatedTicket = await SupportTicket.findById(ticketId)
        .populate("user", "name email avatar")
        .populate("assignedTo", "name email");

    res.status(200).json(
        new ApiResponse(200, updatedTicket, "Message added successfully")
    );
});

// Admin: Get all tickets
const getAllTickets = asyncHandler(async (req, res) => {
    const { status, priority, category, assignedTo, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) query.status = status.toUpperCase();
    if (priority) query.priority = priority.toUpperCase();
    if (category) query.category = category.toUpperCase();
    if (assignedTo) query.assignedTo = assignedTo;

    const skip = (page - 1) * limit;

    const tickets = await SupportTicket.find(query)
        .populate("user", "name email avatar")
        .populate("assignedTo", "name email")
        .sort({ lastMessage: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await SupportTicket.countDocuments(query);

    // Get statistics
    const stats = await SupportTicket.aggregate([
        {
            $group: {
                _id: "$status",
                count: { $sum: 1 }
            }
        }
    ]);

    const priorityStats = await SupportTicket.aggregate([
        {
            $group: {
                _id: "$priority",
                count: { $sum: 1 }
            }
        }
    ]);

    res.status(200).json(
        new ApiResponse(200, {
            tickets,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit),
            stats: stats.reduce((acc, stat) => {
                acc[stat._id] = stat.count;
                return acc;
            }, {}),
            priorityStats: priorityStats.reduce((acc, stat) => {
                acc[stat._id] = stat.count;
                return acc;
            }, {})
        }, "Tickets retrieved successfully")
    );
});

// Admin: Get single ticket
const getAdminTicket = asyncHandler(async (req, res) => {
    const { ticketId } = req.params;

    const ticket = await SupportTicket.findById(ticketId)
        .populate("user", "name email avatar")
        .populate("assignedTo", "name email");

    if (!ticket) {
        throw new ApiError(404, "Ticket not found");
    }

    // Mark messages as read
    await SupportTicket.updateMany(
        { _id: ticketId, "messages.sender": "USER", "messages.isRead": false },
        { $set: { "messages.$.isRead": true } }
    );

    res.status(200).json(
        new ApiResponse(200, ticket, "Ticket retrieved successfully")
    );
});

// Admin: Add admin message
const addAdminMessage = asyncHandler(async (req, res) => {
    const { ticketId } = req.params;
    const { message } = req.body;
    const adminId = req.userId;

    if (!message) {
        throw new ApiError(400, "Message is required");
    }

    const ticket = await SupportTicket.findById(ticketId);

    if (!ticket) {
        throw new ApiError(404, "Ticket not found");
    }

    ticket.messages.push({
        sender: "ADMIN",
        message,
        timestamp: new Date()
    });

    ticket.lastMessage = new Date();
    ticket.assignedTo = adminId;

    if (ticket.status === "OPEN") {
        ticket.status = "IN_PROGRESS";
    }

    await ticket.save();

    const updatedTicket = await SupportTicket.findById(ticketId)
        .populate("user", "name email avatar")
        .populate("assignedTo", "name email");

    res.status(200).json(
        new ApiResponse(200, updatedTicket, "Admin message added successfully")
    );
});

// Admin: Update ticket status
const updateTicketStatus = asyncHandler(async (req, res) => {
    const { ticketId } = req.params;
    const { status, resolution } = req.body;

    const ticket = await SupportTicket.findById(ticketId);

    if (!ticket) {
        throw new ApiError(404, "Ticket not found");
    }

    ticket.status = status;
    if (resolution) {
        ticket.resolution = resolution;
    }

    if (status === "RESOLVED" || status === "CLOSED") {
        ticket.resolvedAt = new Date();
    }

    await ticket.save();

    const updatedTicket = await SupportTicket.findById(ticketId)
        .populate("user", "name email avatar")
        .populate("assignedTo", "name email");

    res.status(200).json(
        new ApiResponse(200, updatedTicket, "Ticket status updated successfully")
    );
});

// Admin: Assign ticket
const assignTicket = asyncHandler(async (req, res) => {
    const { ticketId } = req.params;
    const { assignedTo } = req.body;

    const ticket = await SupportTicket.findById(ticketId);

    if (!ticket) {
        throw new ApiError(404, "Ticket not found");
    }

    if (assignedTo) {
        const admin = await UserModel.findById(assignedTo);
        if (!admin || admin.role !== "ADMIN") {
            throw new ApiError(400, "Invalid admin user");
        }
    }

    ticket.assignedTo = assignedTo || null;
    await ticket.save();

    const updatedTicket = await SupportTicket.findById(ticketId)
        .populate("user", "name email avatar")
        .populate("assignedTo", "name email");

    res.status(200).json(
        new ApiResponse(200, updatedTicket, "Ticket assigned successfully")
    );
});

// Admin: Get unassigned tickets count
const getUnassignedCount = asyncHandler(async (req, res) => {
    const count = await SupportTicket.countDocuments({
        assignedTo: null,
        status: { $in: ["OPEN", "IN_PROGRESS"] }
    });

    res.status(200).json(
        new ApiResponse(200, { count }, "Unassigned tickets count retrieved")
    );
});

// Admin: Get admin's assigned tickets
const getAssignedTickets = asyncHandler(async (req, res) => {
    const adminId = req.userId;
    const { status, page = 1, limit = 20 } = req.query;

    const query = { assignedTo: adminId };
    if (status) {
        query.status = status.toUpperCase();
    }

    const skip = (page - 1) * limit;

    const tickets = await SupportTicket.find(query)
        .populate("user", "name email avatar")
        .sort({ lastMessage: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await SupportTicket.countDocuments(query);

    res.status(200).json(
        new ApiResponse(200, {
            tickets,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        }, "Assigned tickets retrieved successfully")
    );
});

export {
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
};

import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name : {
        type : String,
        required : [true, "Name is required"]
    },
    email : {
        type : String,
        required : [true, "Email is required"],
        unique : true,
        lowercase : true,
        trim : true
    },
    password : {
        type : String,
        required : [true, "Password is required"],
        minLength : [6, "Password must be at least 6 characters"]
    },
    mobile : {
        type : String,
        required : false,
        default: ""
    },
    avatar : {
        type : String,
        default : ""
    },
    verify_email : {
        type : Boolean,
        default : false
    },
    last_login_date : {
        type : Date,
        default : Date.now
    },
    status : {
        type : String,
        enum : ["ACTIVE", "INACTIVE"],
        default : "ACTIVE"
    },
    role : {
        type : String,
        enum : ["USER", "ADMIN"],
        default : "USER"
    },
    // Optional 2FA fields - only used when 2FA is enabled
    twoFactorEnabled: {
        type: Boolean,
        default: false
    },
    twoFactorSecret: {
        type: String,
        default: null
    },
    twoFactorBackupCodes: [{
        type: String
    }],
    twoFactorVerified: {
        type: Boolean,
        default: false
    },
    // Password reset fields
    forgot_password_otp: {
        type: String,
        default: ""
    },
    forgot_password_expiry: {
        type: String,
        default: ""
    }
}, {
    timestamps : true
});

export default mongoose.model("User", userSchema);
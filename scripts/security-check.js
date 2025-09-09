#!/usr/bin/env node

import { runComprehensiveSecurityCheck } from '../utils/securityAudit.js'

// Run the security check
runComprehensiveSecurityCheck()
    .then(result => {
        if (result.score >= 80) {
            process.exit(0)
        } else if (result.score >= 60) {
            process.exit(1)
        } else {
            process.exit(2)
        }
    })
    .catch(error => {
        process.exit(1)
    })

# 👥 Domain Group Management - User Guide

## 🎯 **Overview**

The DonWatcher Domain Group Management feature provides a comprehensive interface for monitoring and managing privileged Active Directory group memberships. This guide walks you through all the new capabilities introduced in Phase 2.

## 🚀 **Getting Started**

### **Prerequisites**
1. **Phase 1 Backend**: Domain scanner data must be uploaded via the PowerShell scanner
2. **Browser Compatibility**: Modern browser (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
3. **Permissions**: Administrative access to DonWatcher dashboard

### **Accessing Domain Groups**
1. Navigate to the DonWatcher dashboard (`http://your-server:8080`)
2. Scroll to the "Domain Scanner - Privileged Groups" section
3. Group tiles will automatically load if domain scanner data is available

## 📊 **Enhanced Group Tiles**

### **Understanding the New Tile Layout**

Each group tile now displays comprehensive information at a glance:

```
┌─────────────────────────────────────┐
│ Domain Admins               [Risk]  │ ← Group name + Risk score badge
│ ⚠️ 2 unaccepted members             │ ← Status indicator
│                                     │
│ Total: 5  Accepted: 3  Unaccepted: 2│ ← Member breakdown
│ ████████░░ 60%                      │ ← Acceptance progress bar
│                                     │
│      [⚙️ Manage Members]            │ ← Action button
└─────────────────────────────────────┘
```

### **Visual Indicators**

#### **Risk Score Badges**
- **🔴 Red (High Risk)**: Score 51-100 - Immediate attention required
- **🟠 Orange (Medium Risk)**: Score 26-50 - Review recommended  
- **🟢 Green (Low Risk)**: Score 0-25 - Acceptable risk level

#### **Status Indicators**
- **✅ Green Check**: All members accepted
- **⚠️ Orange Warning**: Some members unaccepted
- **❌ Red Alert**: High number of unaccepted members

#### **Progress Bars**
- **Blue-Green Gradient**: Shows percentage of accepted members
- **Width**: Represents acceptance rate (100% = full width)

## 🔧 **Member Management Modal**

### **Opening the Modal**
Click the **"Manage Members"** button on any group tile to open the comprehensive member management interface.

### **Modal Layout**

```
┌────────────────────────────────────────────────────────────────┐
│ Domain Admins - corp.example.com • 5 members (3 accepted)  [×] │ ← Header
├────────────────────────────────────────────────────────────────┤
│ 🔍 Search: [____________] [Type▼] [Status▼] [Enabled▼]        │ ← Filters
│ [☑️ Select All] [✅ Accept Selected] [❌ Deny Selected]        │ ← Bulk actions
├────────────────────────────────────────────────────────────────┤
│ ☐ Name           Type      Enabled   Status      Actions      │ ← Table header
│ ☐ Administrator  User      ✅ Yes    ✅ Accepted  [❌]         │
│ ☐ john.doe       User      ✅ Yes    ⚠️ Unaccepted [✅]        │
│ ☐ CORP-DC01$     Computer  ✅ Yes    ⚠️ Unaccepted [✅]        │
│ ☐ service.acc    User      ❌ No     ⚠️ Unaccepted [✅]        │
├────────────────────────────────────────────────────────────────┤
│ 4 of 5 members shown                    [🔄 Refresh] [Close] │ ← Footer
└────────────────────────────────────────────────────────────────┘
```

### **Member Information**

Each member row displays:
- **Name**: Display name from Active Directory
- **SAM Account**: Login name (shown below display name)
- **Type**: User 👤, Computer 🖥️, or Group 👥
- **Enabled Status**: ✅ Enabled, ❌ Disabled, ❓ Unknown
- **Acceptance Status**: ✅ Accepted, ⚠️ Unaccepted
- **Actions**: Accept ✅ or Deny ❌ button

## 🎛️ **Using the Interface**

### **Individual Member Management**

#### **Accepting a Member**
1. Locate the member in the table
2. Click the green **✅ Accept** button
3. Enter an optional reason when prompted
4. Click **OK** to confirm

#### **Denying a Member**
1. Locate the accepted member in the table
2. Click the red **❌ Deny** button  
3. Confirm the action when prompted

### **Bulk Operations**

#### **Selecting Multiple Members**
- **Individual Selection**: Check the box next to each member
- **Select All**: Click the "Select All" button or header checkbox
- **Filter + Select**: Use filters to narrow down, then select all visible

#### **Bulk Accept**
1. Select the members you want to accept
2. Click **"Accept Selected (X)"** button
3. Enter a reason for the bulk acceptance
4. Click **OK** to process all selected members

#### **Bulk Deny**
1. Select the members you want to deny
2. Click **"Deny Selected (X)"** button
3. Confirm the bulk action
4. All selected members will be processed

### **Search and Filtering**

#### **Search Functionality**
- **Search Box**: Type to search by member name or SAM account
- **Real-time Results**: Table updates as you type
- **Case Insensitive**: Search works regardless of capitalization

#### **Filter Options**

**Type Filter**:
- **All Types**: Show all members
- **Users**: Show only user accounts
- **Computers**: Show only computer accounts  
- **Groups**: Show only group members

**Status Filter**:
- **All Status**: Show all members
- **Accepted**: Show only accepted members
- **Unaccepted**: Show only unaccepted members

**Enabled Filter**:
- **All Enabled**: Show all members
- **Enabled**: Show only enabled accounts
- **Disabled**: Show only disabled accounts

## 📱 **Mobile Usage**

### **Mobile-Optimized Interface**
The interface automatically adapts for mobile devices:

- **Single Column Layout**: Group tiles stack vertically
- **Touch-Friendly Buttons**: Larger tap targets for mobile
- **Simplified Modal**: Streamlined interface for smaller screens
- **Swipe Navigation**: Natural mobile gestures supported

### **Mobile-Specific Features**
- **Responsive Tables**: Tables adapt to screen width
- **Collapsible Filters**: Filters collapse on small screens
- **Touch Scrolling**: Smooth scrolling for member lists
- **Optimized Fonts**: Readable text on mobile devices

## 🔄 **Workflow Examples**

### **Daily Security Review Workflow**

1. **Dashboard Scan**: Review all group tiles for high-risk indicators
2. **Priority Groups**: Focus on groups with:
   - High risk scores (red badges)
   - Many unaccepted members (orange warnings)
   - Low acceptance rates (short progress bars)

3. **Group Investigation**: 
   - Click "Manage Members" on concerning groups
   - Review member details and enabled status
   - Check for unusual accounts or service accounts

4. **Member Decisions**:
   - Accept legitimate members with proper justification
   - Investigate suspicious or unknown accounts
   - Deny unauthorized or obsolete accounts

5. **Bulk Processing**:
   - Use filters to find similar members
   - Bulk accept known good accounts
   - Individual review for uncertain cases

### **Compliance Audit Workflow**

1. **Risk Assessment**: Document current risk scores and acceptance rates
2. **Member Verification**: Review all unaccepted members across critical groups
3. **Status Documentation**: Record acceptance decisions with proper justification
4. **Progress Tracking**: Monitor improvement in acceptance rates over time

### **New Domain Scan Processing**

1. **Initial Review**: Check dashboard for new unaccepted members
2. **Categorization**: Group similar members for efficient processing
3. **Bulk Decisions**: Accept known good accounts in batches
4. **Individual Review**: Handle special cases and new accounts individually
5. **Final Verification**: Ensure all critical groups have appropriate acceptance rates

## 🚨 **Best Practices**

### **Security Best Practices**

1. **Regular Reviews**: Check group memberships at least weekly
2. **Prompt Action**: Address high-risk groups immediately
3. **Documentation**: Always provide reasons for acceptance decisions
4. **Verification**: Confirm member legitimacy before accepting
5. **Monitoring**: Track changes in membership over time

### **Operational Best Practices**

1. **Efficient Processing**: Use bulk operations for similar members
2. **Smart Filtering**: Leverage filters to focus on specific member types
3. **Mobile Access**: Use mobile interface for quick reviews on-the-go
4. **Regular Refresh**: Refresh data to ensure current information
5. **Audit Trails**: Maintain clear records of all decisions

### **Performance Best Practices**

1. **Batch Operations**: Process multiple members at once when possible
2. **Targeted Searches**: Use specific search terms for faster results
3. **Filter First**: Apply filters before making selections
4. **Cache Awareness**: Data is cached for 1 minute for better performance

## 🔧 **Troubleshooting**

### **Common Issues**

#### **Group Tiles Not Loading**
- **Cause**: No domain scanner data available
- **Solution**: Run the PowerShell domain scanner and upload data
- **Check**: Verify reports exist at `/api/reports?tool_type=domain_analysis`

#### **Modal Won't Open**
- **Cause**: JavaScript not loaded properly
- **Solution**: Refresh the page and check browser console for errors
- **Check**: Ensure all required JavaScript files are loaded

#### **Slow Performance**
- **Cause**: Large number of group members
- **Solution**: Use filters to reduce displayed members
- **Optimization**: Process members in smaller batches

#### **Mobile Display Issues**
- **Cause**: Browser compatibility or viewport settings
- **Solution**: Use a modern mobile browser
- **Check**: Ensure viewport meta tag is present

### **Error Messages**

#### **"Failed to load group members"**
- **Meaning**: API call to backend failed
- **Action**: Check network connectivity and backend status
- **Retry**: Use the "Retry" button or refresh the page

#### **"Member management modal not available"**
- **Meaning**: Required JavaScript files not loaded
- **Action**: Refresh the page or check browser console
- **Fallback**: Use legacy group details if available

## 📞 **Getting Help**

### **Support Resources**
1. **Technical Documentation**: `/docs/api/domain-groups.md`
2. **Implementation Guide**: `/docs/implementation/PHASE2_IMPLEMENTATION_SUMMARY.md`
3. **Testing Suite**: `/tests/test_frontend_phase2.html`

### **Reporting Issues**
When reporting issues, please include:
- Browser type and version
- Device type (desktop/mobile/tablet)
- Steps to reproduce the problem
- Screenshots if applicable
- Browser console errors (F12 → Console)

---

**🎉 Congratulations! You're now ready to efficiently manage domain group memberships with DonWatcher's enhanced interface. The new tools will help you maintain better security posture and streamline your privileged access management workflows.**

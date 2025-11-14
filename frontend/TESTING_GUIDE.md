# Testing Guide - Phase 5

## Prerequisites

1. **Backend API Running:**
   ```bash
   cd /Users/isaacbailey/projects/todo-api
   npm run dev
   ```
   API should be running at `http://localhost:8787`

2. **Frontend Server:**
   You can use any static file server. Examples:
   ```bash
   # Using Python
   cd /Users/isaacbailey/projects/todo-api/frontend
   python3 -m http.server 8080

   # Using Node.js http-server
   npx http-server -p 8080

   # Using PHP
   php -S localhost:8080
   ```

3. **Browser:**
   Open `http://localhost:8080` in a modern browser (Chrome, Firefox, Safari, or Edge)

## Test Scenarios

### 1. Initial Load (Not Authenticated)

**Steps:**
1. Open `http://localhost:8080` in browser
2. Open browser DevTools console

**Expected Results:**
- URL should redirect to `http://localhost:8080/#/login`
- Login form displayed
- Header shows "Todo App" logo
- Header shows "Log In" and "Sign Up" buttons
- Console logs show:
  - "Initializing Todo App..."
  - "Initializing authentication state..."
  - "Starting router..."
  - "Application initialized successfully"

**Verify:**
- [ ] Login form visible
- [ ] Header rendered correctly
- [ ] No console errors
- [ ] URL is `/#/login`

---

### 2. Navigation Between Login and Register

**Steps:**
1. From login page, click "Sign Up" button in header
2. Verify URL changes to `/#/register`
3. Click "Log In" button in header
4. Verify URL changes to `/#/login`
5. Manually change URL to `/#/register` in address bar
6. Verify register form shows

**Expected Results:**
- Navigation works smoothly
- URL updates correctly
- Forms switch without page reload
- No console errors

**Verify:**
- [ ] Can navigate to register
- [ ] Can navigate back to login
- [ ] Manual URL changes work
- [ ] Browser back/forward buttons work

---

### 3. User Registration Flow

**Steps:**
1. Navigate to register page (`/#/register`)
2. Enter valid email (e.g., `test@example.com`)
3. Enter password (min 8 chars)
4. Enter matching confirm password
5. Click "Sign Up" button

**Expected Results:**
- Button shows loading spinner with "Signing up..." text
- On success:
  - URL redirects to `/#/todos`
  - Header shows user email
  - Header shows "Logout" button
  - Todo page displayed with empty state
  - Console log shows auth state change

**Verify:**
- [ ] Loading state shows during request
- [ ] Redirects to todos page on success
- [ ] Header updates with user info
- [ ] Empty state message visible

---

### 4. User Login Flow

**Steps:**
1. If logged in, logout first
2. Navigate to login page (`/#/login`)
3. Enter registered email
4. Enter password
5. Click "Log In" button

**Expected Results:**
- Button shows loading spinner with "Logging in..." text
- On success:
  - URL redirects to `/#/todos`
  - Header shows user email
  - Header shows "Logout" button
  - Todo page displayed

**Verify:**
- [ ] Login successful
- [ ] Redirects to todos page
- [ ] Authentication persists on page refresh
- [ ] Header shows correct user info

---

### 5. Protected Route Access

**Steps:**
1. Logout if logged in
2. Manually navigate to `/#/todos` in address bar

**Expected Results:**
- Immediately redirects to `/#/login`
- Console log shows "Protected route requires authentication"
- Login form displayed

**Verify:**
- [ ] Cannot access todos without auth
- [ ] Redirects to login
- [ ] No error in console

---

### 6. Create Todo

**Steps:**
1. Login and navigate to todos page
2. In "Create New Todo" form:
   - Enter title: "Buy groceries"
   - Enter description (optional): "Milk, eggs, bread"
3. Click "Create Todo" button

**Expected Results:**
- Button shows loading state with spinner
- On success:
  - Form clears automatically
  - Green success toast appears: "Todo created successfully!"
  - Todo appears in list below
  - List count badge updates

**Verify:**
- [ ] Todo created successfully
- [ ] Form clears after creation
- [ ] Success toast shown
- [ ] Todo appears in list
- [ ] Count badge shows correct number

---

### 7. Toggle Todo Completion

**Steps:**
1. Create a todo (if none exist)
2. Click checkbox next to todo

**Expected Results:**
- Checkbox toggles immediately (optimistic update)
- Title gets strike-through when completed
- Title color changes to gray when completed
- API request made in background
- If API fails, checkbox reverts and error shown

**Verify:**
- [ ] Checkbox toggles instantly
- [ ] Text strike-through when completed
- [ ] Can toggle back to incomplete
- [ ] No delay in UI update

---

### 8. Delete Todo

**Steps:**
1. Create a todo (if none exist)
2. Click delete button (trash icon) next to todo
3. Browser confirmation dialog appears

**Expected Results:**
- Confirmation dialog: "Are you sure you want to delete [title]?"
- If confirmed:
  - Todo fades out with animation
  - API request made
  - Todo removed from list
  - Count badge updates
- If cancelled:
  - Todo remains in list

**Verify:**
- [ ] Confirmation dialog appears
- [ ] Todo deletes on confirm
- [ ] Todo stays on cancel
- [ ] Smooth animation on delete
- [ ] List updates correctly

---

### 9. Empty State

**Steps:**
1. Delete all todos (if any exist)
2. Or login with new account

**Expected Results:**
- List shows empty state
- Icon displayed (clipboard icon)
- Message: "No todos yet"
- Subtitle: "Get started by creating your first todo above."

**Verify:**
- [ ] Empty state displays correctly
- [ ] Message is clear and helpful
- [ ] Icon rendered properly

---

### 10. Form Validation

**Test Title Validation:**
1. Try to submit empty title
   - Expected: "Title is required" error
2. Enter 1 space and submit
   - Expected: "Title cannot be empty" error
3. Enter 201+ characters
   - Expected: "Title must not exceed 200 characters" error

**Test Description Validation:**
1. Enter 1001+ characters in description
   - Expected: "Description must not exceed 1000 characters" error

**Verify:**
- [ ] Title validation works
- [ ] Description validation works
- [ ] Errors display inline
- [ ] Form prevents invalid submission

---

### 11. Loading States

**Test Form Loading:**
1. Create a todo
2. Observe button during submission
   - Expected: Spinner + "Creating..." text
   - Button disabled

**Test List Loading:**
1. Logout and login again (to see initial load)
2. Observe list area
   - Expected: Spinner + "Loading your todos..." text

**Verify:**
- [ ] Form loading state clear
- [ ] List loading state clear
- [ ] Elements disabled during loading

---

### 12. Error Handling

**Test Network Error:**
1. Stop the backend API server
2. Try to create a todo
   - Expected: Error toast with message
3. Try to load todos
   - Expected: Error state with "Try Again" button

**Test Invalid Credentials:**
1. Logout
2. Try to login with wrong password
   - Expected: "Invalid email or password" error

**Verify:**
- [ ] Network errors handled gracefully
- [ ] Error messages user-friendly
- [ ] Retry functionality works

---

### 13. Pagination

**Note:** Pagination only appears if you have > 50 todos.

**Steps to Test:**
1. Create 51+ todos (or use API to bulk create)
2. Scroll to bottom of list

**Expected Results:**
- "Load More" button appears at bottom
- Clicking button loads next 50 todos
- Button shows "Loading..." during fetch
- Todos append to existing list

**Verify:**
- [ ] Load more button appears when hasMore is true
- [ ] Loads additional todos correctly
- [ ] Loading state shows during fetch

---

### 14. Logout Flow

**Steps:**
1. While logged in on todos page
2. Click "Logout" button in header

**Expected Results:**
- Logout button shows loading state
- On success:
  - URL redirects to `/#/login`
  - Header updates to show Login/Register buttons
  - Login form displayed
  - User email no longer visible

**Verify:**
- [ ] Logout successful
- [ ] Redirects to login
- [ ] Header updates correctly
- [ ] Cannot access todos after logout

---

### 15. Page Refresh Persistence

**Steps:**
1. Login and create some todos
2. Refresh page (F5 or Cmd+R)

**Expected Results:**
- User remains logged in
- Todos page loads
- Todos still visible
- No redirect to login

**Verify:**
- [ ] Auth persists across refresh
- [ ] Todos persist in database
- [ ] No data loss
- [ ] Smooth reload experience

---

### 16. Browser Navigation

**Steps:**
1. Login (on `/#/login`)
2. Navigate to todos (`/#/todos`)
3. Navigate to register (`/#/register`) - should redirect to todos
4. Click browser back button
5. Click browser forward button

**Expected Results:**
- Back/forward buttons work
- URL updates correctly
- Auth state respected
- No page reload

**Verify:**
- [ ] Back button works
- [ ] Forward button works
- [ ] History maintained correctly
- [ ] Auth redirects work with history

---

### 17. Accessibility Testing

**Keyboard Navigation:**
1. Use Tab key to navigate through all interactive elements
2. Use Enter/Space to activate buttons
3. Use Arrow keys in form fields

**Expected Results:**
- All elements reachable by keyboard
- Focus indicators visible
- Logical tab order
- Enter submits forms
- Space toggles checkboxes

**Verify:**
- [ ] Can navigate entire app with keyboard
- [ ] Focus indicators clear
- [ ] No keyboard traps
- [ ] Logical tab order

**Screen Reader Testing (Optional):**
1. Enable screen reader (VoiceOver on Mac, NVDA on Windows)
2. Navigate through app
   - Headers announced correctly
   - Buttons labeled
   - Form fields have labels
   - Errors announced

**Verify:**
- [ ] Screen reader can navigate app
- [ ] Content announced logically
- [ ] ARIA labels present

---

### 18. Responsive Design

**Desktop (> 1024px):**
- Full layout with wide containers
- All features visible

**Tablet (640px - 1024px):**
- Adjusted spacing
- Buttons same size

**Mobile (< 640px):**
- Compact layout
- Smaller padding
- Stacked elements
- Touch-friendly buttons

**Test Steps:**
1. Resize browser window to different widths
2. Or use DevTools responsive mode
3. Test all features at each size

**Verify:**
- [ ] Desktop layout looks good
- [ ] Tablet layout works
- [ ] Mobile layout usable
- [ ] No horizontal scrolling
- [ ] Text readable at all sizes

---

### 19. Multiple Todos Management

**Steps:**
1. Create 10 todos
2. Mark some as completed
3. Delete some todos
4. Create more todos
5. Toggle various todos

**Expected Results:**
- List updates correctly after each action
- Count badge accurate
- No duplicate todos
- Order maintained (newest first)
- UI responsive

**Verify:**
- [ ] Multiple operations work smoothly
- [ ] No UI glitches
- [ ] Performance acceptable
- [ ] Data consistency maintained

---

### 20. Edge Cases

**Test Empty Strings:**
1. Enter spaces only in title
   - Expected: Validation error

**Test Special Characters:**
1. Enter title with special chars: `Test <script>alert('xss')</script>`
   - Expected: Renders safely (no script execution)

**Test Long Strings:**
1. Enter max length title (200 chars)
2. Enter max length description (1000 chars)
   - Expected: Accepts without error

**Test Rapid Clicking:**
1. Click create button rapidly multiple times
   - Expected: Only one todo created (button disabled during submission)

**Verify:**
- [ ] Whitespace handled correctly
- [ ] XSS prevention works
- [ ] Max lengths enforced
- [ ] Duplicate submissions prevented

---

## Console Checks

Throughout testing, monitor the browser console for:

**Expected Logs:**
- Router navigation messages
- Auth state changes
- Component lifecycle logs
- API request information (if enabled)

**Should NOT See:**
- Red error messages
- Uncaught exceptions
- 404 errors for resources
- CORS errors

---

## Performance Checks

**Initial Load:**
- Should be < 2 seconds on decent connection
- Components load without flicker
- Smooth transitions

**Interactions:**
- Button clicks respond instantly
- Optimistic updates immediate
- API responses < 500ms (local dev)
- Animations smooth (60fps)

---

## Known Issues to Watch For

1. **Token Expiry:** Tokens expire after 7 days. If testing old tokens, may need to clear localStorage and re-login.

2. **CORS Issues:** If API not running or wrong URL, will see CORS errors. Check `config.js` API_BASE_URL.

3. **LocalStorage Full:** If testing heavily, localStorage might fill up. Clear if needed.

4. **Browser Cache:** If making changes, hard refresh (Ctrl+F5 or Cmd+Shift+R) to clear cache.

---

## Quick Test Checklist

For a quick smoke test, verify these critical paths:

- [ ] Register new user
- [ ] Login with user
- [ ] Create a todo
- [ ] Toggle todo completion
- [ ] Delete a todo
- [ ] Logout
- [ ] Login again (verify todos persisted)
- [ ] Page refresh maintains auth
- [ ] Protected route redirects when logged out

---

## Troubleshooting

**If login fails:**
1. Check backend API is running at `http://localhost:8787`
2. Check browser console for errors
3. Verify `config.js` has correct API_BASE_URL
4. Check Network tab for request details

**If todos don't load:**
1. Check authentication state in console
2. Verify access token in localStorage
3. Check Network tab for 401 errors
4. Try logout and login again

**If styling looks wrong:**
1. Verify Tailwind CSS CDN loaded (check Network tab)
2. Hard refresh browser (Ctrl+F5)
3. Check for CSP errors in console

**If routing doesn't work:**
1. Verify hash in URL (should be `#/login` not `/login`)
2. Check console for router logs
3. Try clearing URL hash and reloading

---

## Browser DevTools Tips

**Useful Console Commands:**
```javascript
// Check auth state
authState.getIsAuthenticated()
authState.getCurrentUser()

// Check tokens
localStorage.getItem('todo_app_access_token')
localStorage.getItem('todo_app_refresh_token')

// Clear auth (logout manually)
localStorage.clear()

// Check current route
window.location.hash
```

**Network Tab:**
- Monitor API requests
- Check request/response headers
- Verify status codes
- Check request timing

**Application Tab:**
- View LocalStorage contents
- Check stored tokens
- Clear storage if needed

---

## Success Criteria

The application passes Phase 5 testing if:

1. All user flows work end-to-end
2. No console errors during normal usage
3. Authentication persists across refresh
4. All CRUD operations succeed
5. UI is responsive on all screen sizes
6. Keyboard navigation works throughout
7. Error states handle gracefully
8. Loading states display correctly
9. Form validation prevents invalid input
10. Protected routes enforce authentication

---

## Next Steps After Testing

Once Phase 5 testing is complete:

1. **Document Issues:** Note any bugs or improvements
2. **Performance Profiling:** Use DevTools to profile if slow
3. **Accessibility Audit:** Run Lighthouse accessibility scan
4. **User Testing:** Get feedback from actual users
5. **Plan Phase 6:** Advanced features based on testing insights

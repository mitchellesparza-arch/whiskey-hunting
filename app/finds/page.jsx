// Finds has moved to the home route (/).
// This redirect keeps any direct links to /finds working.
import { redirect } from 'next/navigation'

export default function FindsRedirect() {
  redirect('/')
}

// /unicorn is now /marketplace — redirect permanently
import { redirect } from 'next/navigation'

export default function UnicornRedirect() {
  redirect('/marketplace')
}

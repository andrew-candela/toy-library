
# Toy Library

A way for folks to advertise toys they'd like to give away,
and to express interest in toys the'd like to borrow.

## Image Loading In Dev

Toy images are stored and served by the backend at `/images/<filename>`.

- Docker dev: frontend sets `VITE_IMAGE_PROXY_TARGET=http://backend:8000` (via `compose.yml`) so Vite can proxy `/images/*` to the backend container.
- Local non-Docker frontend dev: proxy defaults to `http://localhost:8000`.

If you see `ECONNREFUSED` for `/images/...` in Vite logs, verify the backend is running and that `VITE_IMAGE_PROXY_TARGET` points at the reachable backend host.


## ToDo

- username filter doesn't clear
- implement semantic search.
    - index images when they are added
- change style of toys link on user list page
- put link to username of partner in transfer email
- age range removal from UI
- more info in emails. Add a link to sign in on transfer requests
    I should put it in the password recovery email.
- Create `ToyBox`s. Users can add toys they have into a ToyBox. Other users can request the box.
- original ownership of an item
- search for toys based on image


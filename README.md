
# Toy Library


## Data Model

### Tags (try semantic search first)

Toys will have tags associated with them.
When creating a toy, you can assign existing tags or create new ones


### Toys

Toys have tags.


## Semantic search (later)

Users supply an image when creating a Toy.

- save the image
- vectorize the image
- search results

## ToDo


- metrics. Can probably use prometheus fastAPI instrumenter
- username recovery. If someone forgets their username, they can't get it back.
I should put it in the password recovery email.
- more info in emails. Add a link to sign in on transfer requests
- handle deletes better. Users just get an error message 
if they attempt to delete a toy that has Items
- users can supply image
- save images?
- Create `ToyBox`s. Users can add toys they have into a ToyBox. Other users can request the box.
- original ownership of an item
- search for toys based on image
- Items inherit tags from the Toy and suppliment with their own


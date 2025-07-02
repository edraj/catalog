# Setup

Installing all packages and dependencies.
- `yarn`
- `npm i`

To run the project:
- `yarn dev`
- `npm run dev`

To build the project:
- `yarn build`
- `npm run build`

To preview the project as production:
- `yarn preview`
- `npm run preview`

# Seeding

## Running from local

- Point dmart service to the project spaces by updating the `SPACES_FOLDER` in `config.env`.
- Run `json_to_db` script to seed the database with the json files in the project spaces.
- Note: revert the `SPACES_FOLDER` to the original value after seeding.

## Running from podman
- Using podman copy command:
- - `podman cp [options] [container:]src_path [container:]dest_path`
- - `podman cp spaces dmart:/home/dmart/sample/`
- `podman exec -it -w /home/dmart/backend dmart /home/venv/bin/python3 ./migrate.py json_to_db`
- Run `json_to_db` script to seed the database with the json files in the project spaces.
- Note: You can safely ignore the error messages that are related to duplicated entries.

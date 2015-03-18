#!/usr/bin/env bash

set -e


DESTINATION="v2:/var/www/public.aliax.net/doctortc/"

rsync -avu --no-perms --delete-excluded --delete dist test $DESTINATION

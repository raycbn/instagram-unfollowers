const zipInput = document.getElementById("zipInput");
const status = document.getElementById("status");

const stats = document.getElementById("stats");
const results = document.getElementById("results");

const followersCount = document.getElementById("followersCount");
const followingCount = document.getElementById("followingCount");
const notFollowingCount = document.getElementById("notFollowingCount");

const userList = document.getElementById("userList");
const search = document.getElementById("search");

const selectAll = document.getElementById("selectAll");
const clearAll = document.getElementById("clearAll");

const debug = document.getElementById("debug");
const debugContent = document.getElementById("debugContent");

let notFollowingUsers = [];


/* ========================================
   CARGAR ZIP
======================================== */

zipInput.addEventListener("change", async (event) => {

    const file = event.target.files[0];

    if (!file) return;

    try {

        status.textContent =
            "⏳ Analizando ZIP de Instagram...";

        stats.classList.add("hidden");
        results.classList.add("hidden");
        debug.classList.add("hidden");

        const zip =
            await JSZip.loadAsync(file);

        const allFiles =
            Object.keys(zip.files);


        /* ========================================
           LOCALIZAR ARCHIVOS
        ======================================== */

        const followersFiles = allFiles
            .filter(path => {

                const name =
                    path.split("/").pop().toLowerCase();

                return /^followers(_\d+)?\.json$/i
                    .test(name);

            })
            .sort((a, b) => {

                return getFileNumber(a) -
                       getFileNumber(b);

            });


        const followingFiles = allFiles
            .filter(path => {

                const name =
                    path.split("/").pop().toLowerCase();

                return /^following(_\d+)?\.json$/i
                    .test(name);

            });


        console.log(
            "Followers:",
            followersFiles
        );

        console.log(
            "Following:",
            followingFiles
        );


        /* ========================================
           DEBUG
        ======================================== */

        debug.classList.remove("hidden");

        debugContent.innerHTML = `

            <p>
                <strong>Archivos followers:</strong>
                ${followersFiles.length}
            </p>

            <p>
                <strong>Archivos following:</strong>
                ${followingFiles.length}
            </p>

            <details>
                <summary>
                    Ver archivos detectados
                </summary>

                <pre>${escapeHtml(
                    [
                        ...followersFiles,
                        ...followingFiles
                    ].join("\n")
                )}</pre>

            </details>
        `;


        /* ========================================
           COMPROBAR ARCHIVOS
        ======================================== */

        if (
            followersFiles.length === 0
        ) {

            status.textContent =
                "❌ No encuentro followers_*.json";

            return;

        }


        if (
            followingFiles.length === 0
        ) {

            status.textContent =
                "❌ No encuentro following.json";

            return;

        }


        /* ========================================
           FOLLOWERS
        ======================================== */

        const followers =
            new Set();


        for (
            const filename of followersFiles
        ) {

            const zipFile =
                zip.files[filename];

            if (
                !zipFile ||
                zipFile.dir
            ) {
                continue;
            }


            const content =
                await zipFile.async("string");


            let data;

            try {

                data =
                    JSON.parse(content);

            } catch {

                console.warn(
                    "No se pudo leer:",
                    filename
                );

                continue;

            }


            /*
             * followers_1.json normalmente
             * es directamente un ARRAY.
             */

            const users =
                extractFollowers(data);


            users.forEach(username =>
                followers.add(username)
            );

        }


        /* ========================================
           FOLLOWING
        ======================================== */

        const following =
            new Set();


        for (
            const filename of followingFiles
        ) {

            const zipFile =
                zip.files[filename];

            if (
                !zipFile ||
                zipFile.dir
            ) {
                continue;
            }


            const content =
                await zipFile.async("string");


            let data;

            try {

                data =
                    JSON.parse(content);

            } catch {

                console.warn(
                    "No se pudo leer:",
                    filename
                );

                continue;

            }


            /*
             * following.json normalmente
             * tiene:
             *
             * {
             *   relationships_following: [...]
             * }
             */

            const users =
                extractFollowing(data);


            users.forEach(username =>
                following.add(username)
            );

        }


        /* ========================================
           DEBUG DETALLADO
        ======================================== */

        debugContent.innerHTML += `

            <hr>

            <p>
                <strong>Followers encontrados:</strong>
                ${followers.size}
            </p>

            <p>
                <strong>Following encontrados:</strong>
                ${following.size}
            </p>

        `;


        /* ========================================
           COMPROBACIONES
        ======================================== */

        if (
            followers.size === 0
        ) {

            status.textContent =
                "❌ No hemos podido extraer los seguidores.";

            return;

        }


        if (
            following.size === 0
        ) {

            status.textContent =
                "❌ Hemos encontrado el archivo following.json pero no hemos podido extraer sus usuarios.";

            return;

        }


        /* ========================================
           COMPARAR
        ======================================== */

        notFollowingUsers =
            [...following]
                .filter(
                    username =>
                        !followers.has(username)
                )
                .sort(
                    (a, b) =>
                        a.localeCompare(b)
                );


        /* ========================================
           ESTADÍSTICAS
        ======================================== */

        followersCount.textContent =
            followers.size;

        followingCount.textContent =
            following.size;

        notFollowingCount.textContent =
            notFollowingUsers.length;


        stats.classList.remove(
            "hidden"
        );

        results.classList.remove(
            "hidden"
        );


        renderUsers();


        status.textContent =
            `✅ Análisis completado. ${notFollowingUsers.length} cuentas no te siguen.`;


    } catch (error) {

        console.error(error);

        status.textContent =
            "❌ Error analizando el ZIP.";

        debug.classList.remove(
            "hidden"
        );

        debugContent.innerHTML += `

            <hr>

            <pre>${escapeHtml(
                error.stack ||
                error.toString()
            )}</pre>

        `;

    }

});


/* ========================================
   EXTRAER FOLLOWERS
======================================== */

function extractFollowers(data) {

    const usernames =
        new Set();


    /*
     * Formato habitual:
     *
     * [
     *   {
     *     "string_list_data": [
     *       {
     *         "value": "usuario"
     *       }
     *     ]
     *   }
     * ]
     */


    if (
        Array.isArray(data)
    ) {

        for (
            const entry of data
        ) {

            extractFromEntry(
                entry,
                usernames
            );

        }

        return usernames;

    }


    /*
     * Por si Instagram cambia
     * el formato.
     */

    extractRecursively(
        data,
        usernames
    );


    return usernames;

}


/* ========================================
   EXTRAER FOLLOWING
======================================== */

function extractFollowing(data) {

    const usernames =
        new Set();


    /*
     * FORMATO ACTUAL:
     *
     * {
     *   "relationships_following": [
     *
     *      {
     *        "title": "usuario",
     *
     *        "string_list_data": [
     *          {
     *            "value": "usuario"
     *          }
     *        ]
     *      }
     *
     *   ]
     * }
     */


    if (
        data &&
        Array.isArray(
            data.relationships_following
        )
    ) {

        for (
            const entry
            of data.relationships_following
        ) {

            /*
             * Primero intentamos title.
             */

            if (
                typeof entry.title === "string"
            ) {

                const username =
                    cleanUsername(
                        entry.title
                    );

                if (username) {

                    usernames.add(
                        username
                    );

                }

            }


            /*
             * También comprobamos
             * string_list_data.
             */

            extractFromEntry(
                entry,
                usernames
            );

        }


        return usernames;

    }


    /*
     * FORMATO ALTERNATIVO
     */

    extractRecursively(
        data,
        usernames
    );


    return usernames;

}


/* ========================================
   EXTRAER UNA ENTRADA
======================================== */

function extractFromEntry(
    entry,
    usernames
) {

    if (
        !entry ||
        typeof entry !== "object"
    ) {

        return;

    }


    /*
     * string_list_data
     */

    if (
        Array.isArray(
            entry.string_list_data
        )
    ) {

        for (
            const item
            of entry.string_list_data
        ) {

            if (
                item &&
                typeof item.value === "string"
            ) {

                const username =
                    cleanUsername(
                        item.value
                    );

                if (username) {

                    usernames.add(
                        username
                    );

                }

            }

        }

    }


    /*
     * title
     */

    if (
        typeof entry.title === "string"
    ) {

        const username =
            cleanUsername(
                entry.title
            );

        if (username) {

            usernames.add(
                username
            );

        }

    }

}


/* ========================================
   EXTRACCIÓN RECURSIVA
======================================== */

function extractRecursively(
    data,
    usernames
) {

    if (!data) return;


    if (
        Array.isArray(data)
    ) {

        data.forEach(item =>
            extractRecursively(
                item,
                usernames
            )
        );

        return;

    }


    if (
        typeof data === "object"
    ) {

        extractFromEntry(
            data,
            usernames
        );


        Object.values(data)
            .forEach(value =>
                extractRecursively(
                    value,
                    usernames
                )
            );

    }

}


/* ========================================
   LIMPIAR USERNAME
======================================== */

function cleanUsername(value) {

    if (!value) {
        return null;
    }


    const username =
        value
            .trim()
            .replace(/^@/, "")
            .toLowerCase();


    if (
        !/^[a-zA-Z0-9._]+$/.test(
            username
        )
    ) {

        return null;

    }


    if (
        username.length > 40
    ) {

        return null;

    }


    return username;

}


/* ========================================
   NÚMERO DEL ARCHIVO
======================================== */

function getFileNumber(path) {

    const name =
        path
            .split("/")
            .pop();


    const match =
        name.match(
            /followers_(\d+)\.json/i
        );


    if (!match) {
        return 1;
    }


    return parseInt(
        match[1],
        10
    );

}


/* ========================================
   RENDERIZAR USUARIOS
======================================== */

function renderUsers() {

    const query =
        search.value
            .trim()
            .toLowerCase();


    userList.innerHTML = "";


    const filtered =
        notFollowingUsers
            .filter(username =>
                username.includes(query)
            );


    filtered.forEach(username => {

        const row =
            document.createElement(
                "div"
            );

        row.className =
            "user";


        const checkbox =
            document.createElement(
                "input"
            );

        checkbox.type =
            "checkbox";

        checkbox.className =
            "userCheckbox";

        checkbox.value =
            username;


        const span =
            document.createElement(
                "span"
            );

        span.textContent =
            "@" + username;


        row.appendChild(
            checkbox
        );

        row.appendChild(
            span
        );


        userList.appendChild(
            row
        );

    });

}


/* ========================================
   BUSCADOR
======================================== */

search.addEventListener(
    "input",
    renderUsers
);


/* ========================================
   SELECCIONAR TODOS
======================================== */

selectAll.addEventListener(
    "click",
    () => {

        document
            .querySelectorAll(
                ".userCheckbox"
            )
            .forEach(
                checkbox =>
                    checkbox.checked = true
            );

    }
);


/* ========================================
   DESELECCIONAR
======================================== */

clearAll.addEventListener(
    "click",
    () => {

        document
            .querySelectorAll(
                ".userCheckbox"
            )
            .forEach(
                checkbox =>
                    checkbox.checked = false
            );

    }
);


/* ========================================
   ESCAPAR HTML
======================================== */

function escapeHtml(text) {

    return String(text)
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}


/* ========================================
   SERVICE WORKER
======================================== */

if (
    "serviceWorker" in navigator
) {

    window.addEventListener(
        "load",
        () => {

            navigator
                .serviceWorker
                .register(
                    "service-worker.js"
                )
                .catch(error =>
                    console.log(
                        "Service Worker:",
                        error
                    )
                );

        }
    );

}

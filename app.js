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

let notFollowingUsers = [];


/* ========================================
   CARGAR ZIP
======================================== */

zipInput.addEventListener("change", async (event) => {

    const file = event.target.files[0];

    if (!file) return;

    try {

        status.textContent = "⏳ Analizando tu archivo de Instagram...";

        const zip = await JSZip.loadAsync(file);

        const files = Object.keys(zip.files);

        console.log("Archivos del ZIP:", files);


        /* ========================================
           BUSCAR ARCHIVOS CORRECTAMENTE
        ======================================== */

        const followersFiles = [];
        const followingFiles = [];

        for (const path of files) {

            const fileName = path
                .split("/")
                .pop()
                .toLowerCase();

            /*
             * FOLLOWERS
             *
             * Aceptamos:
             * followers.json
             * followers_1.json
             * followers_2.json
             * followers.html
             * followers_1.html
             */

            if (
                /^followers(_\d+)?\.(json|html)$/i.test(fileName)
            ) {
                followersFiles.push(path);
            }


            /*
             * FOLLOWING
             *
             * Aceptamos:
             * following.json
             * following.html
             */

            if (
                /^following\.(json|html)$/i.test(fileName)
            ) {
                followingFiles.push(path);
            }

        }


        console.log("Archivos FOLLOWERS:", followersFiles);
        console.log("Archivos FOLLOWING:", followingFiles);


        if (followersFiles.length === 0) {

            status.textContent =
                "❌ No encuentro los archivos de seguidores.";

            return;
        }


        if (followingFiles.length === 0) {

            status.textContent =
                "❌ No encuentro el archivo de seguidos.";

            return;
        }


        /* ========================================
           LEER FOLLOWERS
        ======================================== */

        const followers = new Set();

        for (const filename of followersFiles) {

            const file = zip.files[filename];

            if (!file || file.dir) continue;

            const content =
                await file.async("string");

            const usernames =
                extractUsernames(content);

            usernames.forEach(username => {
                followers.add(username);
            });

        }


        /* ========================================
           LEER FOLLOWING
        ======================================== */

        const following = new Set();

        for (const filename of followingFiles) {

            const file = zip.files[filename];

            if (!file || file.dir) continue;

            const content =
                await file.async("string");

            const usernames =
                extractUsernames(content);

            usernames.forEach(username => {
                following.add(username);
            });

        }


        /* ========================================
           COMPARAR
        ======================================== */

        notFollowingUsers = [...following]
            .filter(username => !followers.has(username))
            .sort();


        /* ========================================
           MOSTRAR ESTADÍSTICAS
        ======================================== */

        followersCount.textContent =
            followers.size;

        followingCount.textContent =
            following.size;

        notFollowingCount.textContent =
            notFollowingUsers.length;


        stats.classList.remove("hidden");
        results.classList.remove("hidden");

        renderUsers();


        status.textContent =
            `✅ Análisis completado. ${notFollowingUsers.length} cuentas no te siguen.`;


    } catch (error) {

        console.error(error);

        status.textContent =
            "❌ Error leyendo el archivo. Revisa la consola.";

    }

});


/* ========================================
   EXTRAER USUARIOS
======================================== */

function extractUsernames(content) {

    const usernames = new Set();


    /* ========================================
       JSON
    ======================================== */

    try {

        const data = JSON.parse(content);

        extractFromJson(data, usernames);

        return usernames;

    } catch (error) {

        // No era JSON.
        // Probamos HTML.

    }


    /* ========================================
       HTML
    ======================================== */

    try {

        const parser =
            new DOMParser();

        const doc =
            parser.parseFromString(
                content,
                "text/html"
            );

        const links =
            doc.querySelectorAll("a");


        links.forEach(link => {

            const text =
                link.textContent
                    .trim()
                    .toLowerCase();

            if (isValidUsername(text)) {

                usernames.add(text);

            }

        });

    } catch (error) {

        console.error(
            "Error leyendo HTML:",
            error
        );

    }


    return usernames;

}


/* ========================================
   RECORRER JSON
======================================== */

function extractFromJson(
    data,
    usernames
) {

    if (!data) return;


    if (Array.isArray(data)) {

        data.forEach(item => {

            extractFromJson(
                item,
                usernames
            );

        });

        return;
    }


    if (
        typeof data === "object"
    ) {


        /*
         * Formato habitual de Instagram:
         *
         * {
         *   "string_list_data": [
         *      {
         *        "value": "usuario"
         *      }
         *   ]
         * }
         */

        if (
            Array.isArray(
                data.string_list_data
            )
        ) {

            data.string_list_data
                .forEach(item => {

                    if (
                        item &&
                        typeof item.value === "string"
                    ) {

                        const username =
                            item.value
                                .trim()
                                .toLowerCase();

                        if (
                            isValidUsername(
                                username
                            )
                        ) {

                            usernames.add(
                                username
                            );

                        }

                    }

                });

        }


        /*
         * Continuar recorriendo
         * todos los objetos.
         */

        Object.values(data)
            .forEach(value => {

                extractFromJson(
                    value,
                    usernames
                );

            });

    }

}


/* ========================================
   VALIDAR USERNAME
======================================== */

function isValidUsername(username) {

    if (!username) return false;

    if (username.length > 40) {
        return false;
    }

    return /^[a-zA-Z0-9._]+$/.test(
        username
    );

}


/* ========================================
   MOSTRAR USUARIOS
======================================== */

function renderUsers() {

    const query =
        search.value
            .trim()
            .toLowerCase();

    userList.innerHTML = "";


    const filtered =
        notFollowingUsers.filter(
            username =>
                username.includes(query)
        );


    filtered.forEach(username => {

        const row =
            document.createElement(
                "div"
            );

        row.className = "user";


        const checkbox =
            document.createElement(
                "input"
            );

        checkbox.type = "checkbox";

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
            .forEach(checkbox => {

                checkbox.checked = true;

            });

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
            .forEach(checkbox => {

                checkbox.checked = false;

            });

    }
);


/* ========================================
   SERVICE WORKER
======================================== */

if ("serviceWorker" in navigator) {

    window.addEventListener(
        "load",
        () => {

            navigator.serviceWorker
                .register(
                    "service-worker.js"
                )
                .catch(error => {

                    console.log(
                        "Service Worker:",
                        error
                    );

                });

        }
    );

}

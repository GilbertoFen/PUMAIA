import pdf from 'pdf-parse-new';

interface DatosAlumno {
    numCuenta: string | undefined;
    nombre: string | undefined;
    planEstudios: string | undefined;
    promedio: string | undefined;
    creditosTotales: string | undefined;
    aprobadas: string | undefined;
}

export interface ProcessedAcademicHistory {
    markdown: string;
    detectedSemester: number | null;
    groups: string[];
}

/**
 * Determina el semestre máximo encontrado a partir de los prefijos de los grupos (11 al 18).
 * 11.. -> 1°
 * 12.. -> 2°
 * 13.. -> 3°
 * 14.. -> 4°
 * 15.. -> 5°
 * 16.. -> 6°
 * 17.. -> 7°
 * 18.. -> 8°
 */
export function extractMaxSemesterFromGroups(groups: string[]): number | null {
    if (!groups || groups.length === 0) return null;

    const validPrefixes = groups
        .map((g) => (g || '').trim())
        .map((g) => parseInt(g.slice(0, 2), 10))
        .filter((p) => !isNaN(p) && p >= 11 && p <= 18);

    if (validPrefixes.length === 0) return null;

    const maxPrefix = Math.max(...validPrefixes);
    return maxPrefix - 10;
}

export async function procesarYValidarHistorial(dataBuffer: Buffer): Promise<ProcessedAcademicHistory | null> {
    try {
        const data = await pdf(dataBuffer);
        const texto: string = data.text; 

        const datos: DatosAlumno = {
            numCuenta: texto.match(/NÚMERO DE CUENTA:\s+(\d+)/)?.[1],
            nombre: texto.match(/NOMBRE:\s+([A-Z\s]+)/)?.[1]?.trim(),
            planEstudios: texto.match(/PLAN DE ESTUDIOS:\s+([\d\s\-A-ZÁÉÍÓÚ]+)/)?.[1]?.trim(),
            promedio: texto.match(/PROMEDIO\s+([\d.]+)/)?.[1],
            creditosTotales: texto.match(/TOTALES:\s+\d+\s+de\s+(\d+)/)?.[1],
            aprobadas: texto.match(/APROBADAS:\s+(\d+)/)?.[1]
        };

        const camposObligatorios: { id: keyof DatosAlumno; nombre: string }[] = [
            { id: 'numCuenta', nombre: 'Número de Cuenta' },
            { id: 'nombre', nombre: 'Nombre del Alumno' },
            { id: 'planEstudios', nombre: 'Plan de Estudios' },
            { id: 'promedio', nombre: 'Promedio General' },
            { id: 'aprobadas', nombre: 'Materias Aprobadas' }
        ];

        for (const campo of camposObligatorios) {
            if (!datos[campo.id] || datos[campo.id] === "0.00") {
                throw new Error(`VALIDACIÓN FALLIDA: No se pudo encontrar el dato [${campo.nombre}].`);
            }
        }

        const lineas = texto.split('\n');
        const listaMaterias: string[] = []; 
        const gruposEncontrados: string[] = [];
        
        // Regex para capturar materia, calificación, tipo y grupo al final de la línea
        // Ej: 0240 1106 12 OBL ALGEBRA SUPERIOR 8 ORD 2024-1 4542670 1152 1
        const materiaRegex = /^0240\s+\d{4}\s+\d{2}\s+(?:OBL|OPT)\s+(.+?)\s+(\d{1,2})\s+(ORD|EXT)(?:\s+[\d-]+\s+\d+\s+(\d{4,5}))?/;

        lineas.forEach(linea => {
            const trimmed = linea.trim();
            const match = trimmed.match(materiaRegex);
            if (match) {
                const nombreMateria = match[1].trim();
                const calif = match[2];
                const tipo = match[3];
                const grupo = match[4];

                if (grupo) {
                    gruposEncontrados.push(grupo);
                } else {
                    // Intento de fallback para buscar token de grupo de 4 dígitos (11xx a 18xx)
                    const fallbackGroupMatch = trimmed.match(/\b(1[1-8]\d{2})\b/);
                    if (fallbackGroupMatch) {
                        gruposEncontrados.push(fallbackGroupMatch[1]);
                    }
                }

                listaMaterias.push(`- **${nombreMateria}**: ${calif} (${tipo})`);
            }
        });

        if (listaMaterias.length === 0) {
            throw new Error("VALIDACIÓN FALLIDA: El documento no contiene materias.");
        }

        const detectedSemester = extractMaxSemesterFromGroups(gruposEncontrados);

        const markdownFinal = `
            # Historial Académico Validado

            ### Datos del Alumno
            * **Nombre:** ${datos.nombre}
            * **Cuenta:** ${datos.numCuenta} 
            * **Plan:** ${datos.planEstudios} 
            * **Promedio:** ${datos.promedio} 
            ${detectedSemester ? `* **Semestre Detectado:** ${detectedSemester}°` : ''}

            ---

            ### Materias
            ${listaMaterias.join('\n')}
        `.trim();

        return {
            markdown: markdownFinal,
            detectedSemester,
            groups: gruposEncontrados,
        };

    } catch (error: unknown) {
        console.error("❌ ERROR DE CARGA:");
        if (error instanceof Error) {
            console.error(error.message);
        } else {
            console.error("Ocurrió un error desconocido durante el parseo.");
        }
        return null;
    }
}
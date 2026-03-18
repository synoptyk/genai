const Notification = require('../platforms/rrhh/models/Notification');
const UserGenAi = require('../platforms/auth/UserGenAi');
const mailer = require('./mailer');

const normalizeModulePerm = (user, moduleKey) => {
    if (!user || !moduleKey) return false;
    const perms = user.permisosModulos;
    if (!perms) return false;

    let modulePerm = null;
    if (perms instanceof Map) {
        modulePerm = perms.get(moduleKey);
    } else if (typeof perms === 'object') {
        modulePerm = perms[moduleKey];
    }

    if (!modulePerm) return false;
    return Boolean(modulePerm.crear || modulePerm.editar || modulePerm.ver || modulePerm.aprobar);
};

const getAdminAndModuleUsers = async (empresaRef, moduleKey) => {
    const allUsers = await UserGenAi.find({ empresaRef, status: 'Activo' });

    const moduleUsers = moduleKey
        ? allUsers.filter((u) => normalizeModulePerm(u, moduleKey))
        : [];

    const managerRoles = ['ceo_genai', 'ceo', 'gerencia'];
    const managers = allUsers.filter((u) => managerRoles.includes(u.role));

    const allTargets = [...moduleUsers, ...managers];
    const uniqueByEmail = new Map();

    allTargets.forEach((u) => {
        if (u && u.email) uniqueByEmail.set(u.email.toLowerCase(), u);
    });

    return Array.from(uniqueByEmail.values());
};

const createNotification = async ({ user, title, message, type = 'info', link = '', empresaRef, metadata = {} }) => {
    if (!user || !user.email || !empresaRef) return;

    try {
        await Notification.create({
            userEmail: user.email,
            title,
            message,
            type,
            link,
            empresaRef,
            metadata
        });
    } catch (err) {
        console.error('❌ Error creating notification:', err.message);
    }
};

const notifyAction = async ({
    actor,
    moduleKey,
    action,
    entityName,
    entityId = null,
    companyRef,
    isImportant = false,
    messageExtra = '',
    url = '',
    sendEmail = true
}) => {
    if (!actor || !actor.email || !companyRef || !action || !entityName) {
        console.warn('notifyAction: datos insuficientes', { actorEmail: actor?.email, moduleKey, action, entityName });
        return;
    }

    const title = `${actor.name || actor.email} ${action} ${entityName}`;
    const message = `${actor.name || actor.email} ha ${action.toLowerCase()} ${entityName}${messageExtra ? ` (${messageExtra})` : ''}.`;

    // notificar a quien hizo la acción (auto-confirmación)
    await createNotification({
        user: actor,
        title: `Tú: ${title}`,
        message: `Has realizado esta acción en ${moduleKey || 'Sistema'}.`,
        type: 'info',
        link: url || '',
        empresaRef: companyRef,
        metadata: { module: moduleKey, action, entityId, actor: actor.email }
    });

    // notificar a administradores y/o managers
    const recipients = await getAdminAndModuleUsers(companyRef, moduleKey);

    const recipientsWithActor = recipients.filter(u => u.email.toLowerCase() !== actor.email.toLowerCase());

    for (const recipient of recipientsWithActor) {
        await createNotification({
            user: recipient,
            title,
            message,
            type: isImportant ? 'alert' : 'info',
            link: url,
            empresaRef: companyRef,
            metadata: { module: moduleKey, action, entityId, actor: actor.email }
        });
    }

    if (sendEmail && recipientsWithActor.length > 0) {
        try {
            const emails = recipientsWithActor.map((u) => u.email).join(', ');
            const htmlBody = `<p>${message}</p><p>Acción: <strong>${action}</strong><br/>Módulo: <strong>${moduleKey}</strong><br/>Entidad: <strong>${entityName}</strong></p>`;
            await mailer.sendUpdateNotification({
                email: emails,
                name: actor.name || actor.email,
                changes: [{ label: 'Action', value: action }, { label: 'Módulo', value: moduleKey }, { label: 'Entidad', value: entityName }],
                companyName: actor.empresa?.nombre,
                companyLogo: actor.empresa?.logo
            });
        } catch (err) {
            console.error('❌ Error enviando email de notificación de acción:', err.message);
        }
    }
};

module.exports = {
    notifyAction,
    createNotification,
    getAdminAndModuleUsers
};
import * as _ from 'lodash';
import * as React from 'react';
import { action, observable, reaction } from 'mobx';
import { observer } from 'mobx-react';

import { Headers } from '../../types';

import {
    Handler
} from '../../model/rules/rules';
import {
    StaticResponseHandler,
    ForwardToHostHandler,
    PassThroughHandler
} from '../../model/rules/rule-definitions';
import { getStatusMessage } from '../../model/http-docs';

import { styled } from '../../styles';
import { SelfSizedBaseEditor } from '../editor/base-editor';
import { TextInput } from '../common/inputs';

type HandlerConfigProps<h extends Handler> = {
    handler: h;
    onChange: (handler: h) => void;
    onInvalidState?: () => void;
};

const ConfigContainer = styled.div`
    margin: 5px 0;
`;

const ConfigExplanation = styled.p`
    font-size: ${p => p.theme.textSize};
    opacity: ${p => p.theme.lowlightTextOpacity};
    font-style: italic;
    margin-top: 5px;
`;

export function HandlerConfiguration(props: {
        handler: Handler,
        onChange: (handler: Handler) => void,
        onInvalidState?: () => void
    }
) {
    const { handler, onChange, onInvalidState } = props;

    const configProps = {
        handler: handler as any,
        onChange,
        onInvalidState
    };

    if (handler instanceof StaticResponseHandler) {
        return <StaticResponseHandlerConfig {...configProps} />;
    } else if (handler instanceof ForwardToHostHandler) {
        return <ForwardToHostHandlerConfig {...configProps} />;
    } else if (handler instanceof PassThroughHandler) {
        return <PassThroughHandlerConfig {...configProps} />;
    }

    throw new Error('Unknown handler: ' + handler.type);
}

const StatusContainer = styled.div`
    display: flex;
    flex-direction: row;
    align-items: stretch;

    > :not(:last-child) {
        margin-right: 5px;
    }

    > :last-child {
        flex-grow: 1;
    }
`;

const HeadersContainer = styled.div`
    display: grid;
    grid-gap: 5px;
    grid-template-columns: 1fr 1fr;

    > span:first-child {
        grid-column: 1 / span 2;
    }
`;

const BodyContainer = styled.div`
    > div {
        border-radius: 4px;

    }
`;

@observer
class StaticResponseHandlerConfig extends React.Component<HandlerConfigProps<StaticResponseHandler>> {

    @observable
    statusCode = this.props.handler.status.toString();

    @observable
    statusMessage = this.props.handler.statusMessage;

    // Headers, as an array of [k, v], with multiple values flattened.
    @observable
    headers = Object.entries(this.props.handler.headers || {}).reduce(
        (acc: Array<[string, string]>, [key, value]) => {
            if (_.isArray(value)) {
                acc = acc.concat(value.map(v => [key, v]))
            } else {
                acc.push([key, value || '']);
            }
            return acc;
        }, []
    );

    @observable
    body = (this.props.handler.data || '').toString();

    constructor(props: HandlerConfigProps<StaticResponseHandler>) {
        super(props);

        // If any of our data fields change, rebuild & update the handler
        reaction(() => (
            JSON.stringify(_.pick(this, ['statusCode', 'statusMessage', 'headers', 'body']))
        ), () => this.updateHandler());
    }

    render() {
        const { statusCode, headers, body } = this;

        // Undefined status message = use default. Note that the status
        // message can still be shown as _empty_, just not undefined.
        const statusMessage = this.statusMessage === undefined
            ? getStatusMessage(statusCode)
            : this.statusMessage;

        return <ConfigContainer>
            <StatusContainer>
                <span>Status:</span>

                <TextInput
                    type='number'
                    min='100'
                    max='599'
                    invalid={_.isNaN(parseInt(statusCode, 10))}
                    value={statusCode}
                    onChange={this.setStatus}
                />

                <TextInput
                    value={statusMessage}
                    onChange={this.setStatusMessage}
                />
            </StatusContainer>
            <HeadersContainer>
                <span key='headers'>Headers:</span>

                { _.flatMap(headers, ([key, value], i) => [
                    <TextInput value={key} key={`${i}-key`} onChange={(e) => this.updateHeaderName(i, e)} />,
                    <TextInput value={value} key={`${i}-val`} onChange={(e) => this.updateHeaderValue(i, e)}  />
                ]).concat([
                    <TextInput value='' key={`${headers.length}-key`} onChange={this.addHeaderByName} />,
                    <TextInput value='' key={`${headers.length}-val`} onChange={this.addHeaderByValue} />
                ]) }
            </HeadersContainer>
            <div>
                <SelfSizedBaseEditor
                    language='json'
                    value={body}
                    onChange={this.setBody}
                />
            </div>
        </ConfigContainer>;
    }

    @action.bound
    setStatus(event: React.ChangeEvent<HTMLInputElement>) {
        this.statusCode = event.target.value;

        // Empty status messages reset to default when the status is changed:
        if (this.statusMessage === '') this.statusMessage = undefined;
    }

    @action.bound
    setStatusMessage(event: React.ChangeEvent<HTMLInputElement>) {
        const message = event.target.value;

        if (message !== getStatusMessage(this.statusCode)) {
            this.statusMessage = message;
        } else {
            this.statusMessage = undefined;
        }
    }

    @action.bound
    addHeaderByName(event: React.ChangeEvent<HTMLInputElement>) {
        const name = event.target.value;
        this.headers.push([name, '']);
    }

    @action.bound
    addHeaderByValue(event: React.ChangeEvent<HTMLInputElement>) {
        const value = event.target.value;
        this.headers.push(['', value]);
    }

    @action.bound
    updateHeaderName(index: number, event: React.ChangeEvent<HTMLInputElement>) {
        const name = event.target.value;
        this.headers[index][0] = name;
    }

    @action.bound
    updateHeaderValue(index: number, event: React.ChangeEvent<HTMLInputElement>) {
        const value = event.target.value;
        this.headers[index][1] = value;
    }

    @action.bound
    setBody(body: string) {
        this.body = body;
    }

    updateHandler() {
        const statusCode = parseInt(this.statusCode, 10);
        if (_.isNaN(statusCode)) return;

        this.props.onChange(
            new StaticResponseHandler(
                statusCode,
                this.statusMessage,
                this.body,
                _.fromPairs(this.headers) as Headers
            )
        );
    }
}

const UrlInput = styled(TextInput)`
    width: 100%;
    box-sizing: border-box;
`;

@observer
class ForwardToHostHandlerConfig extends React.Component<HandlerConfigProps<ForwardToHostHandler>> {
    render() {
        return <ConfigContainer>
            <UrlInput
                value={this.props.handler.forwardToLocation}
                onChange={(event) => {
                    const handler = new ForwardToHostHandler(event.target.value);
                    this.props.onChange(handler);
                }}
            />
            <ConfigExplanation>
                All matching requests will be forwarded to {this.props.handler.forwardToLocation},
                retaining their existing path and query string.
            </ConfigExplanation>
        </ConfigContainer>;
    }
}

@observer
class PassThroughHandlerConfig extends React.Component<HandlerConfigProps<PassThroughHandler>> {
    render() {
        return <ConfigContainer>
            <ConfigExplanation>
                All matching traffic will be passed through to the upstream target host.
            </ConfigExplanation>
        </ConfigContainer>;
    }
}
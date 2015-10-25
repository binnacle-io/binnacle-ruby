require 'spec_helper'

describe Binnacle::Trap::ExceptionEvent do
  describe 'initialize' do
    it 'extracts Rails expection information from Action Dispatch request parameters' do
      exception = ZeroDivisionError.new
      env = {}
      env['action_dispatch.request.parameters'] = {}
      env['action_dispatch.request.parameters'][:controller] = 'dashboard'
      env['action_dispatch.request.parameters'][:action] = 'analytics'
      env['action_dispatch.request.parameters'][:module] = 'dashboard'

      exception_event = Binnacle::Trap::ExceptionEvent.new(exception, env)

      expect(exception_event.component).to eq('dashboard')
      expect(exception_event.method).to eq('analytics')
      expect(exception_event.module).to eq('dashboard')
    end

    it 'unwraps original_exception' do
      class MyWrappedError < StandardError
        attr_reader :original_exception
        def initialize(msg, original=$!)
          super(msg)
          @original_exception = original
        end
      end
      original_exception = ZeroDivisionError.new
      exception = MyWrappedError.new("Boom!", original_exception)
      exception_event = Binnacle::Trap::ExceptionEvent.new(exception, {})

      expect(exception_event.exception).to be(original_exception)
    end

    it 'unwraps continous_exception' do
      class MyContinuedError < StandardError
        attr_reader :continued_exception
        def initialize(msg, continous=$!)
          super(msg)
          @continued_exception = continous
        end
      end
      continued_exception = ZeroDivisionError.new
      exception = MyContinuedError.new("Boom!", continued_exception)
      exception_event = Binnacle::Trap::ExceptionEvent.new(exception, {})

      expect(exception_event.exception).to be(continued_exception)
    end
  end

  describe 'build_json_payload' do
    it 'creates a valid JSON payload' do
      exception = ZeroDivisionError.new
      env = {}
      env['action_dispatch.request.parameters'] = {}
      env['action_dispatch.request.parameters'][:controller] = 'dashboard'
      env['action_dispatch.request.parameters'][:action] = 'analytics'
      env['action_dispatch.request.parameters'][:module] = 'dashboard'

      exception_event = Binnacle::Trap::ExceptionEvent.new(exception, env)

      json = {
        :exception=>"ZeroDivisionError",
        :message=>"ZeroDivisionError",
        :component=>"dashboard",
        :method=>"analytics"
      }

      expect(exception_event.json).to match(a_hash_including(json))
    end
  end
end
